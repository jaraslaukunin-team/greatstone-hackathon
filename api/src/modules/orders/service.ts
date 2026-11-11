import { createHash } from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  checkQuality,
  normalizePromoCode,
  type CreateOrderRequest,
  type Layout,
  type OrderAddress,
  type OrderDTO,
  type PhotoMeta,
} from '@picpac/shared';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import type { Db } from '../../db/client.js';
import {
  interactions,
  orderStatusHistory,
  orders,
  productVariants,
  products,
  projectPhotos,
  projects,
} from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { assertProjectAccess } from '../projects/service.js';
import { assertPagesInRange, computeQuote, loadVariant } from '../quote/service.js';

type OrderRow = typeof orders.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new AppError(404, 'NOT_FOUND', 'Заказ не найден');
const photoMissing = () =>
  new AppError(422, 'LAYOUT_PHOTO_MISSING', 'В макете есть фото, которого нет в проекте. Замените его и повторите');

// Хеш не включает expectedTotalKop: повтор уже созданного заказа после смены цены
// возвращает этот заказ, а не ошибку.
export function hashOrderRequest(req: CreateOrderRequest): string {
  const a = req.address;
  const canonical = JSON.stringify({
    projectId: req.projectId,
    delivery: req.delivery,
    promoCode: normalizePromoCode(req.promoCode ?? ''),
    address: a ? [a.recipient, a.phone, a.city, a.street, a.postalCode ?? ''].map((s) => s.trim()) : null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

const formatAddress = (a: OrderAddress): string =>
  `${a.postalCode ? `${a.postalCode}, ` : ''}${a.city}, ${a.street}; тел. ${a.phone}`;

export async function toOrderDTO(db: Db, row: OrderRow): Promise<OrderDTO> {
  const [history, links] = await Promise.all([
    db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, row.id))
      .orderBy(asc(orderStatusHistory.changedAt)),
    db.select({ id: interactions.id }).from(interactions).where(eq(interactions.orderId, row.id)),
  ]);
  return {
    id: row.id,
    number: row.number,
    projectId: row.projectId,
    status: row.status,
    totalKop: row.total,
    currency: 'BYN',
    delivery: row.deliveryMethod,
    createdAt: row.createdAt.toISOString(),
    history: history.map((h) => ({
      status: h.status,
      at: h.changedAt.toISOString(),
      ...(h.comment ? { note: h.comment } : {}),
    })),
    interactionIds: links.map((l) => l.id),
  };
}

function sameRequestOrThrow(existing: OrderRow, hash: string): { row: OrderRow; created: false } {
  if (existing.requestHash !== hash) {
    throw new AppError(
      422,
      'IDEMPOTENCY_KEY_REUSED',
      'Этот ключ уже использован для другого заказа. Начните оформление заново',
    );
  }
  return { row: existing, created: false };
}

export async function createOrder(
  app: FastifyInstance,
  user: AuthUser,
  key: string,
  req: CreateOrderRequest,
): Promise<{ order: OrderDTO; created: boolean }> {
  const db = app.db;
  if (!req.address) throw new AppError(422, 'ADDRESS_REQUIRED', 'Укажите получателя и адрес доставки');
  const project = await assertProjectAccess(db, user, req.projectId, 'organizer');
  const hash = hashOrderRequest(req);
  const now = app.clock.now();

  const result = await db.transaction(async (tx) => {
    // Блокировка проекта: параллельные заказы одного проекта выполняются по очереди.
    await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, project.id)).for('update');

    const findByKey = () =>
      tx
        .select()
        .from(orders)
        .where(and(eq(orders.customerId, user.id), eq(orders.idempotencyKey, key)))
        .then((r) => r[0]);
    const existing = await findByKey();
    if (existing) return sameRequestOrThrow(existing, hash);

    const [locked] = await tx.select().from(projects).where(eq(projects.id, project.id));
    if (!locked || locked.status !== 'draft') {
      throw new AppError(409, 'PROJECT_ORDERED', 'Этот проект уже заказан');
    }

    const variant = await loadVariant(db, locked.variantId);
    const [product] = await db.select().from(products).where(eq(products.id, variant.productId));
    const layout = (locked.layout as Layout | null) ?? { pages: [] };

    // Фото макета должны существовать и принадлежать этому проекту.
    const ids = [...new Set(layout.pages.flatMap((p) => p.cells.map((c) => c.photoId)).filter((x): x is string => x !== null))];
    const valid = ids.filter((id) => UUID.test(id));
    if (valid.length !== ids.length) throw photoMissing();
    const photoRows = valid.length
      ? await tx
          .select()
          .from(projectPhotos)
          .where(and(eq(projectPhotos.projectId, project.id), inArray(projectPhotos.id, valid)))
      : [];
    if (photoRows.length !== valid.length) throw photoMissing();

    // Печать: страница это отпечаток, число страниц считается по копиям; книга: по страницам.
    const pages =
      product?.kind === 'prints'
        ? layout.pages.reduce((sum, p) => sum + (p.copies ?? 1), 0)
        : layout.pages.length;
    assertPagesInRange(variant, pages);

    const metas: Record<string, PhotoMeta> = Object.fromEntries(
      photoRows.map((p) => [p.id, { id: p.id, width: p.width, height: p.height, takenAt: p.takenAt?.toISOString() ?? null }]),
    );
    const blockers = checkQuality(layout, metas, { pageWidthCm: variant.pageWidthCm }).filter(
      (i) => i.severity === 'blocker',
    );
    if (blockers.some((i) => i.kind === 'missing-photo')) throw photoMissing();
    if (blockers.length > 0) {
      throw new AppError(422, 'LAYOUT_BLOCKED', 'В макете остались пустые ячейки. Заполните их и повторите');
    }

    const quote = await computeQuote(
      db,
      { variantId: variant.id, pages, quantity: 1, delivery: req.delivery, promoCode: req.promoCode },
      now,
    );
    if (quote.totalKop !== req.expectedTotalKop) {
      throw new AppError(409, 'PRICE_CHANGED', 'Цена изменилась, проверьте новую сумму и подтвердите заказ', {
        totalKop: quote.totalKop,
      });
    }

    const [row] = await tx
      .insert(orders)
      .values({
        customerId: user.id,
        projectId: project.id,
        idempotencyKey: key,
        requestHash: hash,
        total: quote.totalKop,
        deliveryMethod: req.delivery,
        recipientName: req.address!.recipient,
        address: formatAddress(req.address!),
      })
      .onConflictDoNothing({ target: [orders.customerId, orders.idempotencyKey] })
      .returning();
    if (!row) {
      // Тот же ключ успел занять параллельный запрос с другим проектом.
      const winner = await findByKey();
      if (winner) return sameRequestOrThrow(winner, hash);
      throw new AppError(409, 'CONFLICT', 'Не удалось создать заказ, повторите запрос');
    }
    await tx.insert(orderStatusHistory).values({ orderId: row.id, status: 'accepted', changedBy: user.id });
    await tx.update(projects).set({ status: 'ordered', updatedAt: now }).where(eq(projects.id, project.id));
    return { row, created: true as const };
  });

  if (result.created) {
    await audit(db, { userId: user.id, action: 'order.create', objectType: 'order', objectId: result.row.id, result: 'ok' });
  }
  return { order: await toOrderDTO(db, result.row), created: result.created };
}

export async function listOrders(db: Db, user: AuthUser): Promise<OrderDTO[]> {
  const rows = await db.select().from(orders).where(eq(orders.customerId, user.id)).orderBy(desc(orders.createdAt));
  return Promise.all(rows.map((r) => toOrderDTO(db, r)));
}

async function loadOrder(db: Db, user: AuthUser, id: string, opts: { operatorMay: boolean }): Promise<OrderRow> {
  if (!UUID.test(id)) throw notFound();
  const [row] = await db.select().from(orders).where(eq(orders.id, id));
  const allowed = row && (row.customerId === user.id || (opts.operatorMay && user.role === 'operator'));
  if (allowed) return row;
  await audit(db, { userId: user.id, action: 'access.denied', objectType: 'order', objectId: id, result: 'denied' });
  throw notFound();
}

export async function getOrder(db: Db, user: AuthUser, id: string): Promise<OrderDTO> {
  return toOrderDTO(db, await loadOrder(db, user, id, { operatorMay: true }));
}

// Отмена возможна только в статусе accepted; проект возвращается в черновик для правок.
export async function cancelOrder(db: Db, user: AuthUser, id: string, now: Date): Promise<OrderDTO> {
  const order = await loadOrder(db, user, id, { operatorMay: false });
  const cancelled = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(orders)
      .set({ status: 'cancelled' })
      .where(and(eq(orders.id, order.id), eq(orders.status, 'accepted')))
      .returning();
    if (!row) return null;
    await tx.insert(orderStatusHistory).values({ orderId: row.id, status: 'cancelled', changedBy: user.id });
    if (row.projectId) {
      await tx.update(projects).set({ status: 'draft', updatedAt: now }).where(eq(projects.id, row.projectId));
    }
    return row;
  });
  if (!cancelled) throw new AppError(409, 'CANNOT_CANCEL', 'Заказ уже передан в работу, отменить его нельзя');
  await audit(db, { userId: user.id, action: 'order.cancel', objectType: 'order', objectId: id, result: 'ok' });
  return toOrderDTO(db, cancelled);
}
