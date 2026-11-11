import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, asc, eq } from 'drizzle-orm';
import { auditEntrySchema, orderSchema, type OrderStatus } from '@picpac/shared';
import { auditLog, orderStatusHistory, orders, productVariants, projects } from '../src/db/schema.js';
import { canTransition } from '../src/modules/operator/service.js';
import { seed, testApp } from './helpers.js';

type Session = { token: string; id: string };

describe('правила переходов статусов', () => {
  const chain: OrderStatus[] = ['accepted', 'moderation', 'production', 'ready_for_delivery', 'completed'];

  it('вперёд ровно на один шаг по цепочке', () => {
    for (let i = 0; i < chain.length - 1; i++) expect(canTransition(chain[i]!, chain[i + 1]!)).toBe(true);
    expect(canTransition('accepted', 'production')).toBe(false);
    expect(canTransition('accepted', 'completed')).toBe(false);
  });

  it('назад и на тот же статус нельзя', () => {
    expect(canTransition('moderation', 'accepted')).toBe(false);
    expect(canTransition('production', 'production')).toBe(false);
  });

  it('отмена возможна из accepted и moderation, из остальных статусов нет', () => {
    expect(canTransition('accepted', 'cancelled')).toBe(true);
    expect(canTransition('moderation', 'cancelled')).toBe(true);
    expect(canTransition('production', 'cancelled')).toBe(false);
    expect(canTransition('ready_for_delivery', 'cancelled')).toBe(false);
  });

  it('completed и cancelled конечные', () => {
    for (const to of [...chain, 'cancelled' as const]) {
      expect(canTransition('completed', to)).toBe(false);
      expect(canTransition('cancelled', to)).toBe(false);
    }
  });
});

describe('оператор и статусы заказа', () => {
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
  const call = (s: Session, method: 'GET' | 'POST', url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as object | undefined, headers: { authorization: `Bearer ${s.token}` } });
  const setStatus = (s: Session, id: string, status: string, comment?: string) =>
    call(s, 'POST', `/operator/orders/${id}/status`, { status, ...(comment ? { comment } : {}) });

  // Заказ создаётся строкой в БД вместе с проектом: путь оформления проверен в задаче про заказы.
  async function makeOrder(owner: Session, status: OrderStatus = 'accepted') {
    const variantId = (await db.select().from(productVariants).where(eq(productVariants.format, 'Classic 20×20')))[0]!.id;
    const [project] = await db
      .insert(projects)
      .values({ ownerId: owner.id, variantId, title: 'Заказ', status: 'ordered' })
      .returning();
    const [order] = await db
      .insert(orders)
      .values({
        customerId: owner.id,
        projectId: project!.id,
        idempotencyKey: randomUUID(),
        requestHash: 'h',
        total: 8790,
        deliveryMethod: 'belpost',
        status,
      })
      .returning();
    await db.insert(orderStatusHistory).values({ orderId: order!.id, status, changedBy: owner.id });
    return { orderId: order!.id, projectId: project!.id };
  }

  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => new Date();
    alice = await guest();
    bob = await guest();
    operator = await login('operator@test.local');
  });

  it('клиент получает 403 на все три маршрута, каждый отказ попадает в журнал', async () => {
    const { orderId } = await makeOrder(alice);
    const responses = [
      await call(alice, 'GET', '/operator/orders'),
      await setStatus(alice, orderId, 'moderation'),
      await call(alice, 'GET', '/operator/audit'),
    ];
    for (const r of responses) {
      expect(r.statusCode).toBe(403);
      expect(r.json().error.code).toBe('FORBIDDEN');
    }
    const denied = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, alice.id), eq(auditLog.action, 'access.denied')));
    expect(denied).toHaveLength(3);
    expect((await db.select().from(orders).where(eq(orders.id, orderId)))[0]!.status).toBe('accepted');
  });

  it('без токена: 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/operator/orders' })).statusCode).toBe(401);
  });

  it('оператор видит заказы всех клиентов и фильтрует по статусу', async () => {
    const a = await makeOrder(alice);
    const b = await makeOrder(bob, 'production');
    const all = (await call(operator, 'GET', '/operator/orders')).json() as { id: string }[];
    const ids = all.map((o) => o.id);
    expect(ids).toContain(a.orderId);
    expect(ids).toContain(b.orderId);
    expect(all.length).toBeGreaterThanOrEqual(7);
    const production = (await call(operator, 'GET', '/operator/orders?status=production')).json() as {
      id: string;
      status: string;
    }[];
    expect(production.every((o) => o.status === 'production')).toBe(true);
    expect(production.map((o) => o.id)).toContain(b.orderId);
    expect(production.map((o) => o.id)).not.toContain(a.orderId);
    expect((await call(operator, 'GET', '/operator/orders?status=nonsense')).statusCode).toBe(400);
  });

  it('accepted → moderation: строка истории с автором и комментарием, клиент видит новый статус, журнал order.status', async () => {
    const { orderId } = await makeOrder(alice);
    const res = await setStatus(operator, orderId, 'moderation', 'Проверяем макет');
    expect(res.statusCode).toBe(200);
    const dto = orderSchema.parse(res.json());
    expect(dto.status).toBe('moderation');
    expect(dto.history.map((h) => h.status)).toEqual(['accepted', 'moderation']);
    expect(dto.history[1]!.note).toBe('Проверяем макет');

    const rows = await db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(asc(orderStatusHistory.changedAt));
    expect(rows.at(-1)).toMatchObject({ status: 'moderation', changedBy: operator.id, comment: 'Проверяем макет' });

    const seen = orderSchema.parse((await call(alice, 'GET', `/orders/${orderId}`)).json());
    expect(seen.status).toBe('moderation');

    const logged = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, operator.id), eq(auditLog.action, 'order.status')));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ objectType: 'order', objectId: orderId, result: 'ok' });
  });

  it('accepted → completed и обратный переход: 409 INVALID_TRANSITION, статус не меняется', async () => {
    const { orderId } = await makeOrder(alice);
    const skip = await setStatus(operator, orderId, 'completed');
    expect(skip.statusCode).toBe(409);
    expect(skip.json().error.code).toBe('INVALID_TRANSITION');
    await setStatus(operator, orderId, 'moderation');
    const back = await setStatus(operator, orderId, 'accepted');
    expect(back.statusCode).toBe(409);
    expect((await db.select().from(orders).where(eq(orders.id, orderId)))[0]!.status).toBe('moderation');
  });

  it('вся цепочка проходит шаг за шагом, после completed изменить нельзя', async () => {
    const { orderId } = await makeOrder(alice);
    for (const next of ['moderation', 'production', 'ready_for_delivery', 'completed']) {
      expect((await setStatus(operator, orderId, next)).statusCode).toBe(200);
    }
    expect((await setStatus(operator, orderId, 'cancelled', 'поздно')).statusCode).toBe(409);
    const hist = await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId));
    expect(hist).toHaveLength(5);
  });

  it('отмена оператором на модерации: нужна причина, проект возвращается в черновик', async () => {
    const { orderId, projectId } = await makeOrder(alice, 'moderation');
    const noReason = await setStatus(operator, orderId, 'cancelled');
    expect(noReason.statusCode).toBe(422);
    expect(noReason.json().error.code).toBe('COMMENT_REQUIRED');
    const res = await setStatus(operator, orderId, 'cancelled', 'Нечитаемое фото на 3 странице');
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('cancelled');
    expect((await db.select().from(projects).where(eq(projects.id, projectId)))[0]!.status).toBe('draft');
  });

  it('отмена из production запрещена: 409 INVALID_TRANSITION', async () => {
    const { orderId } = await makeOrder(alice, 'production');
    const res = await setStatus(operator, orderId, 'cancelled', 'причина');
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INVALID_TRANSITION');
  });

  it('два одновременных одинаковых перехода: один проходит, второй 409, в истории одна новая строка', async () => {
    const { orderId } = await makeOrder(alice);
    const results = await Promise.all([setStatus(operator, orderId, 'moderation'), setStatus(operator, orderId, 'moderation')]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const hist = await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId));
    expect(hist).toHaveLength(2);
  });

  it('неизвестный заказ и не uuid: 404; неизвестный статус и слишком длинный комментарий: 400', async () => {
    expect((await setStatus(operator, '00000000-0000-4000-8000-000000000000', 'moderation')).statusCode).toBe(404);
    expect((await setStatus(operator, 'not-a-uuid', 'moderation')).statusCode).toBe(404);
    const { orderId } = await makeOrder(alice);
    expect((await setStatus(operator, orderId, 'shipped')).statusCode).toBe(400);
    expect((await setStatus(operator, orderId, 'moderation', 'я'.repeat(501))).statusCode).toBe(400);
  });

  it('журнал для оператора: новые записи сверху, лимит учитывается, неверный лимит 400', async () => {
    const { orderId } = await makeOrder(alice);
    await setStatus(operator, orderId, 'moderation');
    const res = await call(operator, 'GET', '/operator/audit?limit=5');
    expect(res.statusCode).toBe(200);
    const entries = (res.json() as unknown[]).map((e) => auditEntrySchema.parse(e));
    expect(entries.length).toBeLessThanOrEqual(5);
    expect(entries[0]).toMatchObject({ action: 'order.status', userId: operator.id, objectId: orderId });
    const times = entries.map((e) => Date.parse(e.at));
    expect([...times].sort((x, y) => y - x)).toEqual(times);
    for (const bad of ['0', '501', 'abc', '-1']) {
      expect((await call(operator, 'GET', `/operator/audit?limit=${bad}`)).statusCode).toBe(400);
    }
  });
});
