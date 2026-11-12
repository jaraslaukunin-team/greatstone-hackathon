import { desc, eq } from 'drizzle-orm';
import type { AuditEntryDTO, OrderDTO, OrderStatus } from '@picpac/shared';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import type { Db } from '../../db/client.js';
import { auditLog, orders, profiles } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { toOrderDTO, toOrderDTOs, transitionOrder } from '../orders/service.js';

export const OPERATOR_ORDERS_LIMIT = 200;

const CHAIN: OrderStatus[] = ['accepted', 'moderation', 'production', 'ready_for_delivery', 'completed'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Вперёд ровно на один шаг по цепочке; отмена только до начала производства.
// completed и cancelled конечные.
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === 'cancelled') return from === 'accepted' || from === 'moderation';
  const i = CHAIN.indexOf(from);
  return i >= 0 && CHAIN.indexOf(to) === i + 1;
}

export async function listAllOrders(db: Db, status?: OrderStatus): Promise<OrderDTO[]> {
  const query = db.select().from(orders);
  const rows = await (status ? query.where(eq(orders.status, status)) : query)
    .orderBy(desc(orders.createdAt))
    .limit(OPERATOR_ORDERS_LIMIT);
  return toOrderDTOs(db, rows);
}

export async function changeStatus(
  db: Db,
  operator: AuthUser,
  id: string,
  to: OrderStatus,
  comment: string | undefined,
  now: Date,
): Promise<OrderDTO> {
  if (!UUID.test(id)) throw new AppError(404, 'NOT_FOUND', 'Заказ не найден');
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) throw new AppError(404, 'NOT_FOUND', 'Заказ не найден');
  const note = comment?.trim() || null;
  if (to === 'cancelled' && !note) {
    throw new AppError(422, 'COMMENT_REQUIRED', 'При отмене заказа укажите причину для клиента');
  }
  const invalid = (reason: string) => new AppError(409, 'INVALID_TRANSITION', reason);
  if (!canTransition(order.status, to)) {
    throw invalid(`Из статуса «${order.status}» в «${to}» перейти нельзя`);
  }
  const row = await transitionOrder(db, { orderId: id, from: order.status, to, actorId: operator.id, comment: note, now });
  // Пока мы проверяли, статус успел поменять другой запрос.
  if (!row) throw invalid('Статус заказа уже изменён, обновите страницу');
  await audit(db, { userId: operator.id, action: 'order.status', objectType: 'order', objectId: id, result: 'ok' });
  return toOrderDTO(db, row);
}

export async function listAudit(db: Db, limit: number): Promise<AuditEntryDTO[]> {
  // Журнал не ссылается на профили внешним ключом (переживает удаление пользователя), поэтому имя берём левым соединением.
  const rows = await db
    .select({ entry: auditLog, actorName: profiles.displayName, actorRole: profiles.role })
    .from(auditLog)
    .leftJoin(profiles, eq(profiles.id, auditLog.userId))
    .orderBy(desc(auditLog.at), desc(auditLog.id))
    .limit(limit);
  return rows.map(({ entry: r, actorName, actorRole }) => ({
    id: r.id,
    userId: r.userId,
    actorName: actorName ?? null,
    actorRole: actorRole ?? null,
    at: r.at.toISOString(),
    action: r.action,
    objectType: r.objectType,
    objectId: r.objectId,
    result: r.result as AuditEntryDTO['result'],
  }));
}
