import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { interactionSchema, orderSchema } from '@picpac/shared';
import { auditLog, interactionMessages, interactions, orders, productVariants, projects } from '../src/db/schema.js';
import { seed, testApp } from './helpers.js';

type Session = { token: string; id: string };

describe('обращения в поддержку', () => {
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

  async function makeOrder(owner: Session) {
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
      })
      .returning();
    return order!.id;
  }
  const open = (s: Session, orderId: string, extra: Record<string, unknown> = {}) =>
    call(s, 'POST', `/orders/${orderId}/interactions`, { topic: 'Сроки', body: 'Когда будет готов заказ?', ...extra });

  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => new Date();
    alice = await guest();
    bob = await guest();
    operator = await login('operator@test.local');
  });

  it('клиент создаёт обращение по своему заказу: первое сообщение внутри, заказ ссылается на обращение, журнал interaction.create', async () => {
    const orderId = await makeOrder(alice);
    const res = await open(alice, orderId);
    expect(res.statusCode).toBe(201);
    const dto = interactionSchema.parse(res.json());
    expect(dto).toMatchObject({ orderId, customerId: alice.id, topic: 'Сроки', status: 'open' });
    expect(dto.messages).toHaveLength(1);
    expect(dto.messages[0]).toMatchObject({ authorId: alice.id, authorRole: 'customer', body: 'Когда будет готов заказ?' });

    const order = orderSchema.parse((await call(alice, 'GET', `/orders/${orderId}`)).json());
    expect(order.interactionIds).toEqual([dto.id]);
    const logged = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, alice.id), eq(auditLog.action, 'interaction.create')));
    expect(logged).toHaveLength(1);
  });

  it('по чужому заказу и по не-uuid: 404, обращение не создаётся, отказ в журнале', async () => {
    const orderId = await makeOrder(alice);
    const res = await open(bob, orderId);
    expect(res.statusCode).toBe(404);
    expect((await open(bob, 'not-a-uuid')).statusCode).toBe(404);
    expect(await db.select().from(interactions).where(eq(interactions.orderId, orderId))).toHaveLength(0);
    const denied = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, bob.id), eq(auditLog.action, 'access.denied')));
    expect(denied.length).toBeGreaterThanOrEqual(1);
  });

  it('тема и текст обязательны и ограничены по длине: 400', async () => {
    const orderId = await makeOrder(alice);
    for (const extra of [{ topic: '   ' }, { body: '' }, { topic: 'т'.repeat(201) }, { body: 'с'.repeat(4001) }]) {
      expect((await open(alice, orderId, extra)).statusCode).toBe(400);
    }
  });

  it('клиент видит только свои обращения, оператор все', async () => {
    const a = await makeOrder(alice);
    const b = await makeOrder(bob);
    const ia = (await open(alice, a)).json() as { id: string };
    const ib = (await open(bob, b)).json() as { id: string };
    const mine = ((await call(alice, 'GET', '/interactions')).json() as { id: string }[]).map((i) => i.id);
    expect(mine).toEqual([ia.id]);
    const all = ((await call(operator, 'GET', '/interactions')).json() as { id: string }[]).map((i) => i.id);
    expect(all).toContain(ia.id);
    expect(all).toContain(ib.id);
    expect(all.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /interactions/:id: владелец и оператор 200, чужой 404 с записью в журнал, не-uuid 404', async () => {
    const orderId = await makeOrder(alice);
    const { id } = (await open(alice, orderId)).json() as { id: string };
    expect((await call(alice, 'GET', `/interactions/${id}`)).statusCode).toBe(200);
    expect((await call(operator, 'GET', `/interactions/${id}`)).statusCode).toBe(200);
    expect((await call(bob, 'GET', `/interactions/${id}`)).statusCode).toBe(404);
    expect((await call(bob, 'GET', '/interactions/not-a-uuid')).statusCode).toBe(404);
    const denied = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, bob.id), eq(auditLog.action, 'access.denied'), eq(auditLog.objectId, id)));
    expect(denied).toHaveLength(1);
  });

  it('ответ оператора переводит обращение в answered, ответ клиента возвращает в open, порядок сообщений сохраняется', async () => {
    const orderId = await makeOrder(alice);
    const { id } = (await open(alice, orderId)).json() as { id: string };
    const reply = await call(operator, 'POST', `/interactions/${id}/messages`, { body: 'Срок до 10 дней' });
    expect(reply.statusCode).toBe(201);
    const afterOperator = interactionSchema.parse(reply.json());
    expect(afterOperator.status).toBe('answered');
    expect(afterOperator.messages.map((m) => m.authorRole)).toEqual(['customer', 'operator']);

    const again = await call(alice, 'POST', `/interactions/${id}/messages`, { body: 'Спасибо, а можно быстрее?' });
    expect(again.statusCode).toBe(201);
    const afterCustomer = interactionSchema.parse(again.json());
    expect(afterCustomer.status).toBe('open');
    expect(afterCustomer.messages.map((m) => m.body)).toEqual([
      'Когда будет готов заказ?',
      'Срок до 10 дней',
      'Спасибо, а можно быстрее?',
    ]);
    const logged = await db.select().from(auditLog).where(eq(auditLog.action, 'interaction.message'));
    expect(logged).toHaveLength(2);
  });

  it('сообщение в чужое обращение: 404, ничего не сохраняется; пустое сообщение 400; несуществующее обращение 404', async () => {
    const orderId = await makeOrder(alice);
    const { id } = (await open(alice, orderId)).json() as { id: string };
    const res = await call(bob, 'POST', `/interactions/${id}/messages`, { body: 'вклиниваюсь' });
    expect(res.statusCode).toBe(404);
    expect(await db.select().from(interactionMessages).where(eq(interactionMessages.interactionId, id))).toHaveLength(1);
    expect((await call(alice, 'POST', `/interactions/${id}/messages`, { body: '  ' })).statusCode).toBe(400);
    expect(
      (await call(alice, 'POST', '/interactions/00000000-0000-4000-8000-000000000000/messages', { body: 'x' })).statusCode,
    ).toBe(404);
  });

  it('без токена: 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/interactions' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/interactions/x/messages', payload: {} })).statusCode).toBe(401);
  });
});
