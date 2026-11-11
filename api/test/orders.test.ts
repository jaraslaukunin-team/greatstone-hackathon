import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { orderSchema, type Layout } from '@picpac/shared';
import {
  auditLog,
  orderStatusHistory,
  orders,
  productVariants,
  projectPhotos,
  projects,
} from '../src/db/schema.js';
import { seed, testApp } from './helpers.js';

type Session = { token: string; id: string };

const ADDRESS = { recipient: 'Иван Иванов', phone: '+375291234567', city: 'Минск', street: 'ул. Притыцкого, 1' };

describe('заказы и идемпотентность', () => {
  let app: FastifyInstance;
  let db: Awaited<ReturnType<typeof testApp>>['db'];
  let reset: () => Promise<void>;
  let alice: Session;
  let bob: Session;
  let operator: Session;

  beforeAll(async () => {
    ({ app, db, reset } = await testApp());
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  const guest = async (): Promise<Session> => {
    const j = (await app.inject({ method: 'POST', url: '/auth/guest' })).json() as {
      token: string;
      user: { id: string };
    };
    return { token: j.token, id: j.user.id };
  };
  const login = async (contact: string): Promise<Session> => {
    await app.inject({ method: 'POST', url: '/auth/request-code', payload: { contact } });
    const j = (
      await app.inject({ method: 'POST', url: '/auth/verify-code', payload: { contact, code: '000000' } })
    ).json() as { token: string; user: { id: string } };
    return { token: j.token, id: j.user.id };
  };
  const call = (s: Session, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown, key?: string) =>
    app.inject({
      method,
      url,
      payload: payload as object | undefined,
      headers: { authorization: `Bearer ${s.token}`, ...(key ? { 'idempotency-key': key } : {}) },
    });
  const variantByFormat = async (format: string) =>
    (await db.select().from(productVariants).where(eq(productVariants.format, format)))[0]!.id;

  // Проект с готовым макетом: фото вставляются строками в БД (файлы для заказа не нужны).
  async function makeProject(
    owner: Session,
    opts: { format?: string; pages?: number; copies?: number[]; emptyCellAt?: number } = {},
  ) {
    const variantId = await variantByFormat(opts.format ?? 'Classic 20×20');
    const project = (
      await call(owner, 'POST', '/projects', { variantId, title: 'Заказ' })
    ).json() as { id: string };
    const count = opts.copies?.length ?? opts.pages ?? 20;
    const photoIds: string[] = [];
    const pages: Layout['pages'] = [];
    for (let i = 0; i < count; i++) {
      const photoId = randomUUID();
      photoIds.push(photoId);
      await db.insert(projectPhotos).values({
        id: photoId,
        projectId: project.id,
        uploadedBy: owner.id,
        storagePath: `projects/${project.id}/${photoId}`,
        position: i,
        width: 2400,
        height: 1600,
      });
      pages.push({
        template: 'one',
        ...(opts.copies ? { copies: opts.copies[i] } : {}),
        cells: [
          {
            photoId: opts.emptyCellAt === i ? null : photoId,
            crop: { x: 0, y: 0, scale: 1, rotation: 0 },
          },
        ],
      });
    }
    await db.update(projects).set({ layout: { pages } }).where(eq(projects.id, project.id));
    return { projectId: project.id, photoIds, pages };
  }
  const body = (projectId: string, extra: Record<string, unknown> = {}) => ({
    projectId,
    delivery: 'belpost',
    expectedTotalKop: 8790,
    address: ADDRESS,
    ...extra,
  });
  const place = (s: Session, b: Record<string, unknown>, key = randomUUID()) =>
    call(s, 'POST', '/orders', b, key);

  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => new Date();
    alice = await guest();
    bob = await guest();
    operator = await login('operator@test.local');
  });

  it('успешный заказ: 201, статус accepted, одна строка истории, журнал order.create, проект заказан', async () => {
    const { projectId } = await makeProject(alice);
    const res = await place(alice, body(projectId));
    expect(res.statusCode).toBe(201);
    const order = orderSchema.parse(res.json());
    expect(order).toMatchObject({ projectId, status: 'accepted', totalKop: 8790, currency: 'BYN', delivery: 'belpost' });
    expect(order.number).toMatch(/^PP-\d{6}$/);
    expect(order.history).toHaveLength(1);
    expect(order.history[0]!.status).toBe('accepted');
    const hist = await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, order.id));
    expect(hist).toHaveLength(1);
    const logged = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, alice.id), eq(auditLog.action, 'order.create')));
    expect(logged).toHaveLength(1);
    const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
    expect(p!.status).toBe('ordered');
    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row).toMatchObject({ recipientName: 'Иван Иванов', total: 8790 });
    expect(row!.address).toContain('Минск');
  });

  it('промокод применяется на сервере: HELLO10 даёт 7980', async () => {
    const { projectId } = await makeProject(alice);
    const res = await place(alice, body(projectId, { promoCode: ' hello10 ', expectedTotalKop: 7980 }));
    expect(res.statusCode).toBe(201);
    expect(res.json().totalKop).toBe(7980);
  });

  it('тот же ключ и то же тело дважды: второй ответ 200 с тем же заказом, строка одна', async () => {
    const { projectId } = await makeProject(alice);
    const key = randomUUID();
    const first = await place(alice, body(projectId), key);
    const second = await place(alice, body(projectId), key);
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);
    expect(await db.select().from(orders).where(eq(orders.customerId, alice.id))).toHaveLength(1);
  });

  it('повтор после смены цены возвращает уже созданный заказ, а не PRICE_CHANGED', async () => {
    const { projectId } = await makeProject(alice);
    const key = randomUUID();
    const first = await place(alice, body(projectId), key);
    const retry = await place(alice, body(projectId, { expectedTotalKop: 1 }), key);
    expect(retry.statusCode).toBe(200);
    expect(retry.json().id).toBe(first.json().id);
  });

  it('два одновременных запроса с одним ключом: одна строка, оба ответа с одним id', async () => {
    const { projectId } = await makeProject(alice);
    const key = randomUUID();
    const results = await Promise.all([place(alice, body(projectId), key), place(alice, body(projectId), key)]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 201]);
    expect(results[0]!.json().id).toBe(results[1]!.json().id);
    expect(await db.select().from(orders).where(eq(orders.customerId, alice.id))).toHaveLength(1);
  });

  it('тот же ключ с другим содержимым: 422 IDEMPOTENCY_KEY_REUSED', async () => {
    const { projectId } = await makeProject(alice);
    const key = randomUUID();
    await place(alice, body(projectId), key);
    const res = await place(alice, body(projectId, { delivery: 'ems', expectedTotalKop: 10190 }), key);
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await db.select().from(orders).where(eq(orders.customerId, alice.id))).toHaveLength(1);
  });

  it('другой ключ на уже заказанный проект: 409 PROJECT_ORDERED; одновременно два ключа: один заказ', async () => {
    const { projectId } = await makeProject(alice);
    await place(alice, body(projectId));
    const again = await place(alice, body(projectId));
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('PROJECT_ORDERED');

    const other = await makeProject(alice);
    const results = await Promise.all([place(alice, body(other.projectId)), place(alice, body(other.projectId))]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  });

  it('ключ идемпотентности обязателен и должен быть uuid: 400', async () => {
    const { projectId } = await makeProject(alice);
    const none = await call(alice, 'POST', '/orders', body(projectId));
    expect(none.statusCode).toBe(400);
    expect(none.json().error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    const bad = await call(alice, 'POST', '/orders', body(projectId), 'not-a-uuid');
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('сумма не совпала с пересчитанной: 409 PRICE_CHANGED с новой суммой, заказ не создан', async () => {
    const { projectId } = await makeProject(alice);
    const res = await place(alice, body(projectId, { expectedTotalKop: 5000 }));
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('PRICE_CHANGED');
    expect(res.json().error.details).toEqual({ totalKop: 8790 });
    expect(await db.select().from(orders).where(eq(orders.customerId, alice.id))).toHaveLength(0);
    const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
    expect(p!.status).toBe('draft');
  });

  it('адрес обязателен: 422 ADDRESS_REQUIRED', async () => {
    const { projectId } = await makeProject(alice);
    const res = await place(alice, { ...body(projectId), address: undefined });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('ADDRESS_REQUIRED');
  });

  it('макет с пустой ячейкой: 422 LAYOUT_BLOCKED', async () => {
    const { projectId } = await makeProject(alice, { emptyCellAt: 3 });
    const res = await place(alice, body(projectId));
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('LAYOUT_BLOCKED');
  });

  it('макет ссылается на удалённое фото, на фото чужого проекта или на не-uuid: 422 LAYOUT_PHOTO_MISSING', async () => {
    const a = await makeProject(alice);
    await db.delete(projectPhotos).where(eq(projectPhotos.id, a.photoIds[0]!));
    expect((await place(alice, body(a.projectId))).json().error.code).toBe('LAYOUT_PHOTO_MISSING');

    const b = await makeProject(alice);
    const foreign = await makeProject(alice, { pages: 1 });
    const layout = (await db.select().from(projects).where(eq(projects.id, b.projectId)))[0]!.layout as Layout;
    layout.pages[1]!.cells[0]!.photoId = foreign.photoIds[0]!;
    await db.update(projects).set({ layout }).where(eq(projects.id, b.projectId));
    const res = await place(alice, body(b.projectId));
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('LAYOUT_PHOTO_MISSING');

    const c = await makeProject(alice);
    const l2 = (await db.select().from(projects).where(eq(projects.id, c.projectId)))[0]!.layout as Layout;
    l2.pages[0]!.cells[0]!.photoId = 'photo-0';
    await db.update(projects).set({ layout: l2 }).where(eq(projects.id, c.projectId));
    expect((await place(alice, body(c.projectId))).json().error.code).toBe('LAYOUT_PHOTO_MISSING');
  });

  it('страниц меньше минимума варианта: 422 PAGES_OUT_OF_RANGE', async () => {
    const { projectId } = await makeProject(alice, { pages: 5 });
    const res = await place(alice, body(projectId));
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('PAGES_OUT_OF_RANGE');
  });

  it('печать: pages равно сумме copies страниц, заказ один: 6 отпечатков 10×15 и EMS дают 2456', async () => {
    const { projectId } = await makeProject(alice, { format: '10×15 глянцевая', copies: [2, 3, 1] });
    const res = await place(alice, body(projectId, { delivery: 'ems', expectedTotalKop: 2456 }));
    expect(res.statusCode).toBe(201);
    expect(res.json().totalKop).toBe(6 * 61 + 2090);
  });

  it('после заказа макет проекта не меняется: PUT даёт 409 PROJECT_ORDERED', async () => {
    const { projectId, pages } = await makeProject(alice);
    await place(alice, body(projectId));
    const put = await call(alice, 'PUT', `/projects/${projectId}`, { layout: { pages }, version: 1 });
    expect(put.statusCode).toBe(409);
    expect(put.json().error.code).toBe('PROJECT_ORDERED');
  });

  it('чужой заказ: 404; оператор видит; в списке только свои', async () => {
    const { projectId } = await makeProject(alice);
    const order = (await place(alice, body(projectId))).json() as { id: string };
    expect((await call(bob, 'GET', `/orders/${order.id}`)).statusCode).toBe(404);
    expect((await call(bob, 'GET', '/orders')).json()).toEqual([]);
    expect((await call(operator, 'GET', `/orders/${order.id}`)).statusCode).toBe(200);
    const mine = (await call(alice, 'GET', '/orders')).json() as { id: string }[];
    expect(mine.map((o) => o.id)).toEqual([order.id]);
    expect((await call(alice, 'GET', '/orders/not-a-uuid')).statusCode).toBe(404);
  });

  it('отмена: в accepted проходит и возвращает проект в черновик, в production 409 CANNOT_CANCEL, чужой 404', async () => {
    const a = await makeProject(alice);
    const o1 = (await place(alice, body(a.projectId))).json() as { id: string };
    expect((await call(bob, 'POST', `/orders/${o1.id}/cancel`)).statusCode).toBe(404);
    const cancelled = await call(alice, 'POST', `/orders/${o1.id}/cancel`);
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({ status: 'cancelled' });
    expect(cancelled.json().history.map((h: { status: string }) => h.status)).toEqual(['accepted', 'cancelled']);
    const [p] = await db.select().from(projects).where(eq(projects.id, a.projectId));
    expect(p!.status).toBe('draft');
    expect((await call(alice, 'POST', `/orders/${o1.id}/cancel`)).statusCode).toBe(409);

    const b = await makeProject(alice);
    const o2 = (await place(alice, body(b.projectId))).json() as { id: string };
    await db.update(orders).set({ status: 'production' }).where(eq(orders.id, o2.id));
    const res = await call(alice, 'POST', `/orders/${o2.id}/cancel`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CANNOT_CANCEL');
  });

  it('без токена: 401', async () => {
    expect((await app.inject({ method: 'POST', url: '/orders', payload: {} })).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/orders' })).statusCode).toBe(401);
  });
});
