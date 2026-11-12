import { randomUUID } from 'node:crypto';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { InteractionDTO, InteractionMessageDTO } from '@picpac/shared';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import type { Db } from '../../db/client.js';
import { interactionMessages, interactions, profiles } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { loadOrder } from '../orders/service.js';
import { readImageMeta, sniffMime } from '../photos/imageMeta.js';

type InteractionRow = typeof interactions.$inferSelect;

export const INTERACTIONS_LIMIT = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new AppError(404, 'NOT_FOUND', 'Обращение не найдено');

export const supportAttachmentKey = (interactionId: string, messageId: string) =>
  `support/${interactionId}/${messageId}`;

export const attachmentUrl = (interactionId: string, messageId: string) =>
  `/interactions/${interactionId}/attachments/${messageId}`;

// Сообщения всех обращений списка грузятся одним запросом вместе с ролью автора.
async function toDTOs(db: Db, rows: InteractionRow[]): Promise<InteractionDTO[]> {
  if (rows.length === 0) return [];
  const messages = await db
    .select({
      id: interactionMessages.id,
      interactionId: interactionMessages.interactionId,
      authorId: interactionMessages.authorId,
      authorRole: profiles.role,
      body: interactionMessages.body,
      attachmentKey: interactionMessages.attachmentKey,
      createdAt: interactionMessages.createdAt,
    })
    .from(interactionMessages)
    .leftJoin(profiles, eq(profiles.id, interactionMessages.authorId))
    .where(inArray(interactionMessages.interactionId, rows.map((r) => r.id)))
    .orderBy(asc(interactionMessages.createdAt));
  return rows.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    customerId: r.customerId,
    topic: r.topic,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    messages: messages
      .filter((m) => m.interactionId === r.id)
      .map((m): InteractionMessageDTO => ({
        id: m.id,
        authorId: m.authorId,
        authorRole: m.authorRole,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        attachmentUrl: m.attachmentKey ? attachmentUrl(r.id, m.id) : null,
      })),
  }));
}

const toDTO = async (db: Db, row: InteractionRow) => (await toDTOs(db, [row]))[0]!;

// Обращение видит его автор и оператор; чужое выглядит как несуществующее и пишется в журнал.
async function loadInteraction(db: Db, user: AuthUser, id: string): Promise<InteractionRow> {
  if (!UUID.test(id)) throw notFound();
  const [row] = await db.select().from(interactions).where(eq(interactions.id, id));
  if (row && (row.customerId === user.id || user.role === 'operator')) return row;
  await audit(db, { userId: user.id, action: 'access.denied', objectType: 'interaction', objectId: id, result: 'denied' });
  throw notFound();
}

export async function createInteraction(
  db: Db,
  user: AuthUser,
  orderId: string,
  input: { topic: string; body: string },
): Promise<InteractionDTO> {
  const order = await loadOrder(db, user, orderId, { operatorMay: false });
  const row = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(interactions)
      .values({ orderId: order.id, customerId: user.id, topic: input.topic })
      .returning();
    await tx.insert(interactionMessages).values({ interactionId: created!.id, authorId: user.id, body: input.body });
    return created!;
  });
  await audit(db, { userId: user.id, action: 'interaction.create', objectType: 'interaction', objectId: row.id, result: 'ok' });
  return toDTO(db, row);
}

export async function listInteractions(db: Db, user: AuthUser): Promise<InteractionDTO[]> {
  const query = db.select().from(interactions);
  const rows = await (user.role === 'operator' ? query : query.where(eq(interactions.customerId, user.id)))
    .orderBy(desc(interactions.createdAt))
    .limit(INTERACTIONS_LIMIT);
  return toDTOs(db, rows);
}

export async function getInteraction(db: Db, user: AuthUser, id: string): Promise<InteractionDTO> {
  return toDTO(db, await loadInteraction(db, user, id));
}

// Ответ оператора помечает обращение answered, сообщение клиента возвращает его в open.
export async function addMessage(db: Db, user: AuthUser, id: string, body: string): Promise<InteractionDTO> {
  const row = await loadInteraction(db, user, id);
  const updated = await db.transaction(async (tx) => {
    await tx.insert(interactionMessages).values({ interactionId: row.id, authorId: user.id, body });
    const [next] = await tx
      .update(interactions)
      .set({ status: user.role === 'operator' ? 'answered' : 'open' })
      .where(eq(interactions.id, row.id))
      .returning();
    return next!;
  });
  await audit(db, { userId: user.id, action: 'interaction.message', objectType: 'interaction', objectId: id, result: 'ok' });
  return toDTO(db, updated);
}

/** Загружает фото, сохраняет в storage, создаёт сообщение с вложением. */
export async function addPhotoMessage(
  app: FastifyInstance,
  user: AuthUser,
  interactionId: string,
  data: Buffer,
  body: string,
): Promise<InteractionDTO> {
  const row = await loadInteraction(app.db, user, interactionId);
  // Проверяем MIME — 415 для не-изображений.
  await readImageMeta(data);

  const messageId = randomUUID();
  const key = supportAttachmentKey(row.id, messageId);
  await app.storage.put(key, data);
  try {
    const updated = await app.db.transaction(async (tx) => {
      await tx.insert(interactionMessages).values({
        id: messageId,
        interactionId: row.id,
        authorId: user.id,
        body,
        attachmentKey: key,
      });
      const [next] = await tx
        .update(interactions)
        .set({ status: user.role === 'operator' ? 'answered' : 'open' })
        .where(eq(interactions.id, row.id))
        .returning();
      return next!;
    });
    await audit(app.db, { userId: user.id, action: 'interaction.message', objectType: 'interaction', objectId: interactionId, result: 'ok' });
    return toDTO(app.db, updated);
  } catch (e) {
    await app.storage.remove(key).catch(() => undefined);
    throw e;
  }
}

/** Возвращает данные вложения для скачивания; проверяет доступ к обращению. */
export async function getMessageAttachment(
  app: FastifyInstance,
  user: AuthUser,
  interactionId: string,
  messageId: string,
): Promise<{ data: Buffer; mime: string }> {
  // Доступ проверяется через loadInteraction (чужое → 404 + журнал).
  await loadInteraction(app.db, user, interactionId);
  if (!UUID.test(messageId)) throw notFound();
  const [msg] = await app.db
    .select()
    .from(interactionMessages)
    .where(eq(interactionMessages.id, messageId));
  if (!msg || !msg.attachmentKey) throw notFound();
  const data = await app.storage.get(msg.attachmentKey);
  const mime = sniffMime(data) ?? 'application/octet-stream';
  return { data, mime };
}
