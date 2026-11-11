import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { albumProgressSchema, inviteSchema, photoSchema, projectSchema } from '@picpac/shared';
import { auditLog, productVariants, projectInvites, projectMembers, projectPhotos, projects } from '../src/db/schema.js';
import { signToken } from '../src/auth/plugin.js';
import { seed, testApp } from './helpers.js';

type Session = { token: string; id: string };

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-11T12:00:00Z');
const photo = readFileSync(join(__dirname, '..', 'fixtures', 'photo-ok.jpg'));

function multipart(filename: string, data: Buffer) {
  const boundary = `----picpacAlbum${Math.random().toString(16).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  return {
    payload: Buffer.concat([head, data, Buffer.from(`\r\n--${boundary}--\r\n`)]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('совместный альбом', () => {
  let app: FastifyInstance;
  let db: Awaited<ReturnType<typeof testApp>>['db'];
  let reset: () => Promise<void>;
  let alice: Session;
  let bob: Session;
  let carol: Session;
  let projectId: string;

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
  const call = (s: Session | null, method: 'GET' | 'POST' | 'DELETE', url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as object | undefined,
      headers: s ? { authorization: `Bearer ${s.token}` } : {},
    });
  const invite = async (s: Session = alice) => inviteSchema.parse((await call(s, 'POST', `/projects/${projectId}/invites`)).json());
  const accept = (s: Session | null, token: string, childName?: string) =>
    call(s, 'POST', '/invites/accept', { token, ...(childName ? { childName } : {}) });
  const addPhotoRow = (owner: Session, position = 0) =>
    db.insert(projectPhotos).values({
      id: randomUUID(),
      projectId,
      uploadedBy: owner.id,
      storagePath: `projects/${projectId}/${randomUUID()}`,
      position,
      width: 2400,
      height: 1600,
    });
  const members = () => db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId));

  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => NOW;
    alice = await guest();
    bob = await guest();
    carol = await guest();
    const variantId = (await db.select().from(productVariants).where(eq(productVariants.format, 'Выпускной 20×20')))[0]!.id;
    projectId = (
      (await call(alice, 'POST', '/projects', { variantId, title: '11 Б', isShared: true, expectedMembers: 25 })).json() as {
        id: string;
      }
    ).id;
  });

  it('организатор создаёт приглашение на 14 дней; в базе лежит только хеш токена', async () => {
    const res = await call(alice, 'POST', `/projects/${projectId}/invites`);
    expect(res.statusCode).toBe(201);
    const inv = inviteSchema.parse(res.json());
    expect(inv.url).toBe(`picpac://invite/${inv.token}`);
    expect(inv.token.length).toBeGreaterThanOrEqual(32);
    expect(Date.parse(inv.expiresAt)).toBe(NOW.getTime() + 14 * DAY);
    const rows = await db.select().from(projectInvites).where(eq(projectInvites.projectId, projectId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token).not.toBe(inv.token);
    expect(rows[0]!.token).not.toContain(inv.token);
  });

  it('приглашение создают только организатор: посторонний и участник получают 404, без токена 401', async () => {
    const inv = await invite();
    await accept(bob, inv.token);
    expect((await call(carol, 'POST', `/projects/${projectId}/invites`)).statusCode).toBe(404);
    expect((await call(bob, 'POST', `/projects/${projectId}/invites`)).statusCode).toBe(404);
    expect((await call(null, 'POST', `/projects/${projectId}/invites`)).statusCode).toBe(401);
  });

  it('приглашение только для совместного проекта в черновике: 409 PROJECT_NOT_SHARED и PROJECT_ORDERED', async () => {
    const variantId = (await db.select().from(productVariants).where(eq(productVariants.format, 'Classic 20×20')))[0]!.id;
    const solo = (await call(alice, 'POST', '/projects', { variantId, title: 'Личный' })).json() as { id: string };
    const notShared = await call(alice, 'POST', `/projects/${solo.id}/invites`);
    expect(notShared.statusCode).toBe(409);
    expect(notShared.json().error.code).toBe('PROJECT_NOT_SHARED');
    await db.update(projects).set({ status: 'ordered' }).where(eq(projects.id, projectId));
    const ordered = await call(alice, 'POST', `/projects/${projectId}/invites`);
    expect(ordered.statusCode).toBe(409);
    expect(ordered.json().error.code).toBe('PROJECT_ORDERED');
  });

  it('участник принимает приглашение: 200 с проектом, роль contributor, имя ребёнка, журнал album.join', async () => {
    const inv = await invite();
    const res = await accept(bob, inv.token, 'Маша');
    expect(res.statusCode).toBe(200);
    expect(projectSchema.parse(res.json()).id).toBe(projectId);
    const rows = await members();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: bob.id, role: 'contributor', childName: 'Маша' });
    const logged = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, bob.id), eq(auditLog.action, 'album.join')));
    expect(logged).toHaveLength(1);
  });

  it('повторное принятие тем же пользователем, в том числе одновременное: оба ответа 200, одна строка', async () => {
    const inv = await invite();
    expect((await accept(bob, inv.token)).statusCode).toBe(200);
    expect((await accept(bob, inv.token)).statusCode).toBe(200);
    const results = await Promise.all([accept(carol, inv.token), accept(carol, inv.token)]);
    expect(results.map((r) => r.statusCode)).toEqual([200, 200]);
    expect((await members()).map((m) => m.userId).sort()).toEqual([bob.id, carol.id].sort());
  });

  it('организатор принимает собственное приглашение: ничего не добавляется', async () => {
    const inv = await invite();
    const res = await accept(alice, inv.token);
    expect(res.statusCode).toBe(200);
    expect(await members()).toHaveLength(0);
  });

  it('неизвестный токен 404 INVITE_UNKNOWN, истёкший 410 INVITE_EXPIRED, заказанный проект 409, без токена доступа 401', async () => {
    const unknown = await accept(bob, 'a'.repeat(32));
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe('INVITE_UNKNOWN');
    const inv = await invite();
    app.clock.now = () => new Date(NOW.getTime() + 15 * DAY);
    // Токен гостя живёт 7 дней, поэтому на новую дату выпускаем свежий.
    const late: Session = { id: bob.id, token: await signToken(app, { id: bob.id, role: 'customer', guest: true }) };
    const expired = await accept(late, inv.token);
    expect(expired.statusCode).toBe(410);
    expect(expired.json().error.code).toBe('INVITE_EXPIRED');
    expect(await members()).toHaveLength(0);
    app.clock.now = () => NOW;
    await db.update(projects).set({ status: 'ordered' }).where(eq(projects.id, projectId));
    expect((await accept(bob, inv.token)).statusCode).toBe(409);
    expect((await accept(null, inv.token)).statusCode).toBe(401);
    expect((await call(bob, 'POST', '/invites/accept', { token: 'x' })).statusCode).toBe(400);
  });

  it('участник загружает фото, организатор видит все, участник только свои', async () => {
    await accept(bob, (await invite()).token);
    await addPhotoRow(alice, 0);
    const m = multipart('b.jpg', photo);
    const up = await app.inject({
      method: 'POST',
      url: `/projects/${projectId}/photos`,
      payload: m.payload,
      headers: { 'content-type': m.contentType, authorization: `Bearer ${bob.token}` },
    });
    expect(up.statusCode).toBe(201);

    const forAlice = (await call(alice, 'GET', `/projects/${projectId}/photos`)).json() as unknown[];
    expect(forAlice.map((p) => photoSchema.parse(p).uploadedBy).sort()).toEqual([alice.id, bob.id].sort());
    const forBob = (await call(bob, 'GET', `/projects/${projectId}/photos`)).json() as unknown[];
    expect(forBob.map((p) => photoSchema.parse(p).uploadedBy)).toEqual([bob.id]);
  });

  it('участник удаляет только свои фото: чужое 404, организатор удаляет любое', async () => {
    await accept(bob, (await invite()).token);
    await addPhotoRow(alice, 0);
    await addPhotoRow(bob, 1);
    const rows = await db.select().from(projectPhotos).where(eq(projectPhotos.projectId, projectId));
    const aliceRow = rows.find((r) => r.uploadedBy === alice.id)!;
    const bobRow = rows.find((r) => r.uploadedBy === bob.id)!;
    expect((await call(bob, 'DELETE', `/photos/${aliceRow.id}`)).statusCode).toBe(404);
    expect((await call(bob, 'DELETE', `/photos/${bobRow.id}`)).statusCode).toBe(204);
    await addPhotoRow(bob, 2);
    const again = (await db.select().from(projectPhotos).where(eq(projectPhotos.uploadedBy, bob.id)))[0]!;
    expect((await call(alice, 'DELETE', `/photos/${again.id}`)).statusCode).toBe(204);
  });

  it('прогресс: ожидается 25, организатор первым, у каждого участника своё число фото', async () => {
    await accept(bob, (await invite()).token, 'Маша');
    await accept(carol, (await invite()).token, 'Петя');
    await addPhotoRow(alice, 0);
    await addPhotoRow(bob, 1);
    await addPhotoRow(bob, 2);
    const res = await call(alice, 'GET', `/projects/${projectId}/progress`);
    expect(res.statusCode).toBe(200);
    const progress = albumProgressSchema.parse(res.json());
    expect(progress.expected).toBe(25);
    expect(progress.members[0]).toMatchObject({ userId: alice.id, role: 'organizer', photosCount: 1 });
    const by = Object.fromEntries(progress.members.map((m) => [m.userId, m]));
    expect(by[bob.id]).toMatchObject({ role: 'contributor', childName: 'Маша', photosCount: 2 });
    expect(by[carol.id]).toMatchObject({ role: 'contributor', childName: 'Петя', photosCount: 0 });
    expect(progress.members).toHaveLength(3);
    expect((await call(bob, 'GET', `/projects/${projectId}/progress`)).statusCode).toBe(200);
  });

  it('посторонний не видит ни прогресс, ни фото: 404', async () => {
    await addPhotoRow(alice, 0);
    expect((await call(carol, 'GET', `/projects/${projectId}/progress`)).statusCode).toBe(404);
    expect((await call(carol, 'GET', `/projects/${projectId}/photos`)).statusCode).toBe(404);
    expect((await call(null, 'GET', `/projects/${projectId}/progress`)).statusCode).toBe(401);
  });
});
