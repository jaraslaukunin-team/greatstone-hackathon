import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { projectSchema, type Layout } from '@picpac/shared';
import { auditLog, orders, productVariants, projectMembers, projects } from '../src/db/schema.js';
import { seed, testApp } from './helpers.js';

type Session = { token: string; id: string };

describe('проекты и сохранение макета', () => {
  let app: FastifyInstance;
  let db: Awaited<ReturnType<typeof testApp>>['db'];
  let reset: () => Promise<void>;
  let alice: Session;
  let bob: Session;
  let operator: Session;
  let variantId: string;

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
  const call = (s: Session, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as object | undefined,
      headers: { authorization: `Bearer ${s.token}` },
    });
  const create = (s: Session, body: Record<string, unknown> = {}) =>
    call(s, 'POST', '/projects', { variantId, title: 'Лето 2026', ...body });
  const layoutOf = (n: number): Layout => ({
    pages: Array.from({ length: n }, (_, i) => ({
      template: 'one' as const,
      cells: [{ photoId: `photo-${i}`, crop: { x: 0, y: 0, scale: 1, rotation: 0 as const } }],
    })),
  });
  const addOrder = (customerId: string, projectId: string) =>
    db.insert(orders).values({
      customerId,
      projectId,
      idempotencyKey: `k-${projectId}`,
      requestHash: 'h',
      total: 100,
      deliveryMethod: 'ems',
    });

  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => new Date();
    alice = await guest();
    bob = await guest();
    operator = await login('operator@test.local');
    variantId = (await db.select().from(productVariants).where(eq(productVariants.format, 'Classic 20×20')))[0]!.id;
  });

  it('созданный проект: черновик, версия 1, пустой макет, владелец видит его в списке', async () => {
    const res = await create(alice, { isShared: true, expectedMembers: 25, joinPassword: 'album-pass' });
    expect(res.statusCode).toBe(201);
    const p = projectSchema.parse(res.json());
    expect(p).toMatchObject({
      title: 'Лето 2026',
      variantId,
      ownerId: alice.id,
      status: 'draft',
      version: 1,
      isShared: true,
      expectedMembers: 25,
    });
    expect(p.layout).toEqual({ pages: [] });
    const list = (await call(alice, 'GET', '/projects')).json() as { id: string }[];
    expect(list.map((x) => x.id)).toEqual([p.id]);
    expect((await call(alice, 'GET', `/projects/${p.id}`)).statusCode).toBe(200);
  });

  it('чужой клиент не видит проект: 404, отказ попадает в журнал, в его списке пусто', async () => {
    const p = (await create(alice)).json() as { id: string };
    const res = await call(bob, 'GET', `/projects/${p.id}`);
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    expect((await call(bob, 'GET', '/projects')).json()).toEqual([]);
    const denied = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, bob.id), eq(auditLog.action, 'access.denied')));
    expect(denied).toHaveLength(1);
    expect(denied[0]).toMatchObject({ objectType: 'project', objectId: p.id });
  });

  it('оператор видит проект только после появления заказа', async () => {
    const p = (await create(alice)).json() as { id: string };
    expect((await call(operator, 'GET', `/projects/${p.id}`)).statusCode).toBe(404);
    await addOrder(alice.id, p.id);
    expect((await call(operator, 'GET', `/projects/${p.id}`)).statusCode).toBe(200);
  });

  it('макет из 10 страниц сохраняется и читается с тем же порядком, версия растёт', async () => {
    const p = (await create(alice)).json() as { id: string };
    const layout = layoutOf(10);
    const put = await call(alice, 'PUT', `/projects/${p.id}`, { layout, version: 1 });
    expect(put.statusCode).toBe(200);
    expect(put.json()).toEqual({ version: 2 });
    const read = projectSchema.parse((await call(alice, 'GET', `/projects/${p.id}`)).json());
    expect(read.layout.pages.map((pg) => pg.cells[0]!.photoId)).toEqual(
      layout.pages.map((pg) => pg.cells[0]!.photoId),
    );
    expect(read.version).toBe(2);
  });

  it('устаревшая версия даёт 409 VERSION_CONFLICT и не затирает макет', async () => {
    const p = (await create(alice)).json() as { id: string };
    await call(alice, 'PUT', `/projects/${p.id}`, { layout: layoutOf(3), version: 1 });
    const stale = await call(alice, 'PUT', `/projects/${p.id}`, { layout: layoutOf(5), version: 1 });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().error.code).toBe('VERSION_CONFLICT');
    const read = projectSchema.parse((await call(alice, 'GET', `/projects/${p.id}`)).json());
    expect(read.layout.pages).toHaveLength(3);
  });

  it('два одновременных сохранения с одной версией: одно проходит, второе 409', async () => {
    const p = (await create(alice)).json() as { id: string };
    const results = await Promise.all([
      call(alice, 'PUT', `/projects/${p.id}`, { layout: layoutOf(2), version: 1 }),
      call(alice, 'PUT', `/projects/${p.id}`, { layout: layoutOf(4), version: 1 }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  });

  it('заказанный проект не меняется и не удаляется: 409 PROJECT_ORDERED', async () => {
    const p = (await create(alice)).json() as { id: string };
    await db.update(projects).set({ status: 'ordered' }).where(eq(projects.id, p.id));
    const put = await call(alice, 'PUT', `/projects/${p.id}`, { layout: layoutOf(1), version: 1 });
    expect(put.statusCode).toBe(409);
    expect(put.json().error.code).toBe('PROJECT_ORDERED');
    const del = await call(alice, 'DELETE', `/projects/${p.id}`);
    expect(del.statusCode).toBe(409);
    expect(del.json().error.code).toBe('PROJECT_ORDERED');
  });

  it('невалидный макет (scale 0) даёт 422 LAYOUT_INVALID, запрос без версии даёт 400', async () => {
    const p = (await create(alice)).json() as { id: string };
    const bad = layoutOf(1);
    bad.pages[0]!.cells[0]!.crop.scale = 0;
    const res = await call(alice, 'PUT', `/projects/${p.id}`, { layout: bad, version: 1 });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('LAYOUT_INVALID');
    expect((await call(alice, 'PUT', `/projects/${p.id}`, { layout: layoutOf(1) })).statusCode).toBe(400);
  });

  it('удаление: владелец удаляет, чужой получает 404 и проект остаётся', async () => {
    const p = (await create(alice)).json() as { id: string };
    expect((await call(bob, 'DELETE', `/projects/${p.id}`)).statusCode).toBe(404);
    expect((await call(alice, 'GET', `/projects/${p.id}`)).statusCode).toBe(200);
    expect((await call(alice, 'DELETE', `/projects/${p.id}`)).statusCode).toBe(204);
    expect((await call(alice, 'GET', `/projects/${p.id}`)).statusCode).toBe(404);
  });

  it('создание: неизвестный вариант 404 VARIANT_NOT_FOUND, пустой заголовок 400', async () => {
    const missing = await create(alice, { variantId: '00000000-0000-4000-8000-000000000000' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('VARIANT_NOT_FOUND');
    expect((await create(alice, { title: '   ' })).statusCode).toBe(400);
  });

  it('не uuid в пути даёт 404, а не 500', async () => {
    expect((await call(alice, 'GET', '/projects/not-a-uuid')).statusCode).toBe(404);
    expect((await call(alice, 'DELETE', '/projects/not-a-uuid')).statusCode).toBe(404);
  });

  it('участник альбома читает проект и видит его в списке, но менять и удалять не может', async () => {
    const p = (await create(alice, { isShared: true, joinPassword: 'album-pass' })).json() as { id: string };
    await db.insert(projectMembers).values({ projectId: p.id, userId: bob.id, role: 'contributor' });
    expect((await call(bob, 'GET', `/projects/${p.id}`)).statusCode).toBe(200);
    expect(((await call(bob, 'GET', '/projects')).json() as { id: string }[]).map((x) => x.id)).toEqual([p.id]);
    const put = await call(bob, 'PUT', `/projects/${p.id}`, { layout: layoutOf(1), version: 1 });
    expect(put.statusCode).toBe(404);
    expect((await call(bob, 'DELETE', `/projects/${p.id}`)).statusCode).toBe(404);
  });

  it('без токена: 401', async () => {
    expect((await app.inject({ method: 'GET', url: '/projects' })).statusCode).toBe(401);
  });
});
