import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import {
  aiJobs,
  auditLog,
  consents,
  interactionMessages,
  interactions,
  orders,
  productVariants,
  profiles,
  projectMembers,
  projectPhotos,
  projects,
} from '../src/db/schema.js';
import { seed, testApp } from './helpers.js';

type Session = { token: string; id: string };

const SOURCE = readFileSync(join(__dirname, '..', 'fixtures', 'photo-ok.jpg'));

describe('удаление данных пользователя', () => {
  let app: FastifyInstance;
  let db: Awaited<ReturnType<typeof testApp>>['db'];
  let reset: () => Promise<void>;
  let alice: Session;
  let bob: Session;
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
  const del = (s: Session | null) =>
    app.inject({ method: 'DELETE', url: '/me/data', headers: s ? { authorization: `Bearer ${s.token}` } : {} });
  const me = (s: Session) => app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${s.token}` } });

  async function makeProject(owner: Session, status: 'draft' | 'ordered' = 'draft', isShared = false) {
    const [p] = await db
      .insert(projects)
      .values({ ownerId: owner.id, variantId, title: 'Проект', status, isShared })
      .returning();
    return p!.id;
  }
  async function addPhoto(owner: Session, projectId: string, position = 0) {
    const id = randomUUID();
    const key = `projects/${projectId}/${id}`;
    await app.storage.put(key, SOURCE);
    await db.insert(projectPhotos).values({
      id,
      projectId,
      uploadedBy: owner.id,
      storagePath: key,
      position,
      width: 2400,
      height: 1600,
    });
    return { id, key };
  }
  const fileExists = (key: string) =>
    app.storage.get(key).then(
      () => true,
      () => false,
    );

  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => new Date();
    alice = await guest();
    bob = await guest();
    variantId = (await db.select().from(productVariants).where(eq(productVariants.format, 'Classic 20×20')))[0]!.id;
  });

  // Alice: проект из 3 фото, AI-задача и согласие, обращение, заказ; плюс участие в проектах Боба.
  async function populate() {
    const projectId = await makeProject(alice);
    const own = [await addPhoto(alice, projectId, 0), await addPhoto(alice, projectId, 1), await addPhoto(alice, projectId, 2)];
    await db.insert(consents).values({ userId: alice.id, kind: 'ai_processing' });
    await db.insert(aiJobs).values({ userId: alice.id, projectId, sourcePhoto: own[0]!.id, prompt: 'ярче', provider: 'stub' });
    const [order] = await db
      .insert(orders)
      .values({
        customerId: alice.id,
        projectId,
        idempotencyKey: randomUUID(),
        requestHash: 'h',
        total: 8790,
        deliveryMethod: 'belpost',
        recipientName: 'Иван Иванов',
        address: 'Минск, ул. Притыцкого, 1; тел. +375291234567',
      })
      .returning();
    const [thread] = await db
      .insert(interactions)
      .values({ orderId: order!.id, customerId: alice.id, topic: 'Сроки' })
      .returning();
    await db.insert(interactionMessages).values({ interactionId: thread!.id, authorId: alice.id, body: 'Когда будет готов?' });

    const bobDraft = await makeProject(bob, 'draft', true);
    await db.insert(projectMembers).values({ projectId: bobDraft, userId: alice.id, role: 'contributor' });
    const inBobDraft = await addPhoto(alice, bobDraft, 0);
    const bobsOwn = await addPhoto(bob, bobDraft, 1);

    const bobOrdered = await makeProject(bob, 'ordered', true);
    await db.insert(projectMembers).values({ projectId: bobOrdered, userId: alice.id, role: 'contributor' });
    const inBobOrdered = await addPhoto(alice, bobOrdered, 0);
    return { projectId, own, orderId: order!.id, threadId: thread!.id, bobDraft, inBobDraft, bobsOwn, bobOrdered, inBobOrdered };
  }

  it('удаляются проекты, фото и файлы, AI-задачи, согласия, обращения; заказ остаётся обезличенным; токен перестаёт работать', async () => {
    const d = await populate();
    const res = await del(alice);
    expect(res.statusCode).toBe(204);

    expect(await db.select().from(profiles).where(eq(profiles.id, alice.id))).toHaveLength(0);
    expect(await db.select().from(projects).where(eq(projects.ownerId, alice.id))).toHaveLength(0);
    expect(await db.select().from(projectPhotos).where(eq(projectPhotos.projectId, d.projectId))).toHaveLength(0);
    for (const p of d.own) expect(await fileExists(p.key)).toBe(false);
    expect(await db.select().from(aiJobs).where(eq(aiJobs.userId, alice.id))).toHaveLength(0);
    expect(await db.select().from(consents).where(eq(consents.userId, alice.id))).toHaveLength(0);
    expect(await db.select().from(interactions).where(eq(interactions.id, d.threadId))).toHaveLength(0);
    expect(await db.select().from(interactionMessages).where(eq(interactionMessages.interactionId, d.threadId))).toHaveLength(0);
    expect(await db.select().from(projectMembers).where(eq(projectMembers.userId, alice.id))).toHaveLength(0);

    const [order] = await db.select().from(orders).where(eq(orders.id, d.orderId));
    expect(order).toMatchObject({ customerId: null, projectId: null, recipientName: null, address: null, total: 8790 });

    expect((await me(alice)).statusCode).toBe(401);
  });

  it('фото в чужом черновике удаляются вместе с файлом, а в чужом уже заказанном проекте остаются без автора', async () => {
    const d = await populate();
    await del(alice);
    expect(await db.select().from(projectPhotos).where(eq(projectPhotos.id, d.inBobDraft.id))).toHaveLength(0);
    expect(await fileExists(d.inBobDraft.key)).toBe(false);

    const [kept] = await db.select().from(projectPhotos).where(eq(projectPhotos.id, d.inBobOrdered.id));
    expect(kept).toBeDefined();
    expect(kept!.uploadedBy).toBeNull();
    expect(await fileExists(d.inBobOrdered.key)).toBe(true);
  });

  it('другой пользователь не затронут: его проекты, фото и файлы на месте', async () => {
    const d = await populate();
    await del(alice);
    expect(await db.select().from(profiles).where(eq(profiles.id, bob.id))).toHaveLength(1);
    expect(await db.select().from(projects).where(eq(projects.ownerId, bob.id))).toHaveLength(2);
    expect(await db.select().from(projectPhotos).where(eq(projectPhotos.id, d.bobsOwn.id))).toHaveLength(1);
    expect(await fileExists(d.bobsOwn.key)).toBe(true);
    expect((await me(bob)).statusCode).toBe(200);
  });

  it('журнал хранит data.delete с идентификатором удалённого пользователя', async () => {
    await populate();
    await del(alice);
    const logged = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, alice.id), eq(auditLog.action, 'data.delete')));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({ objectType: 'profile', objectId: alice.id, result: 'ok' });
  });

  it('повторный вызов безопасен: 401, ничего не меняется; без токена 401', async () => {
    await populate();
    await del(alice);
    const before = await db.select().from(projects);
    expect((await del(alice)).statusCode).toBe(401);
    expect(await db.select().from(projects)).toHaveLength(before.length);
    expect((await del(null)).statusCode).toBe(401);
    const logged = await db.select().from(auditLog).where(eq(auditLog.action, 'data.delete'));
    expect(logged).toHaveLength(1);
  });

  it('сбой удаления файла не отменяет удаление данных: ответ 204, строки удалены', async () => {
    const d = await populate();
    const original = app.storage;
    app.storage = { ...original, put: original.put.bind(original), get: original.get.bind(original), remove: async () => { throw new Error('диск недоступен'); } };
    try {
      expect((await del(alice)).statusCode).toBe(204);
    } finally {
      app.storage = original;
    }
    expect(await db.select().from(profiles).where(eq(profiles.id, alice.id))).toHaveLength(0);
    expect(await db.select().from(projectPhotos).where(eq(projectPhotos.projectId, d.projectId))).toHaveLength(0);
  });

  it('пользователь без данных тоже удаляется', async () => {
    expect((await del(bob)).statusCode).toBe(204);
    expect(await db.select().from(profiles).where(eq(profiles.id, bob.id))).toHaveLength(0);
  });
});
