import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { albumProgressSchema, inviteSchema, projectSchema, type Layout } from '@picpac/shared';
import { productVariants, projectMembers, projectPhotos, projects } from '../src/db/schema.js';
import { seed, testApp } from './helpers.js';

type Session = { token: string; id: string };

const PW = 'album-pass';

describe('пожелания участников и именная копия', () => {
  let app: FastifyInstance;
  let db: Awaited<ReturnType<typeof testApp>>['db'];
  let reset: () => Promise<void>;
  let alice: Session; // организатор
  let bob: Session;
  let carol: Session;
  let outsider: Session;
  let projectId: string;

  beforeAll(async () => {
    ({ app, db, reset } = await testApp());
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  const guest = async (): Promise<Session> => {
    const j = (await app.inject({ method: 'POST', url: '/auth/guest' })).json() as { token: string; user: { id: string } };
    return { token: j.token, id: j.user.id };
  };
  const call = (s: Session | null, method: 'GET' | 'POST' | 'PUT' | 'PATCH', url: string, payload?: unknown) =>
    app.inject({ method, url, payload: payload as object | undefined, headers: s ? { authorization: `Bearer ${s.token}` } : {} });
  const join = async (s: Session, childName: string) => {
    const inv = inviteSchema.parse((await call(alice, 'POST', `/projects/${projectId}/invites`)).json());
    const res = await call(s, 'POST', '/invites/accept', { token: inv.token, password: PW, childName });
    expect(res.statusCode).toBe(200);
  };

  beforeEach(async () => {
    await reset();
    await seed(db);
    alice = await guest();
    bob = await guest();
    carol = await guest();
    outsider = await guest();
    const variantId = (await db.select().from(productVariants).where(eq(productVariants.format, 'Выпускной 20×20')))[0]!.id;
    projectId = ((await call(alice, 'POST', '/projects', { variantId, title: '11 Б', isShared: true, expectedMembers: 25, joinPassword: PW })).json() as { id: string }).id;
    await join(bob, 'Борис');
    await join(carol, 'Вера');
  });

  const rowOf = async (s: Session) => (await db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId))).find((m) => m.userId === s.id)!;

  it('участник обновляет свои имя, пожелание и ссылку на видео; они видны в прогрессе', async () => {
    const res = await call(bob, 'PATCH', `/projects/${projectId}/members/me`, { childName: 'Борис П.', wish: 'Удачи, 11 Б!', videoUrl: 'https://youtu.be/abc' });
    expect(res.statusCode).toBe(200);
    const progress = albumProgressSchema.parse((await call(alice, 'GET', `/projects/${projectId}/progress`)).json());
    expect(progress.members.find((m) => m.userId === bob.id)).toMatchObject({ childName: 'Борис П.', wish: 'Удачи, 11 Б!', videoUrl: 'https://youtu.be/abc' });
  });

  it('запрос меняет только запись самого вызывающего: чужая запись не затрагивается', async () => {
    await call(bob, 'PATCH', `/projects/${projectId}/members/me`, { wish: 'от Бориса' });
    await call(carol, 'PATCH', `/projects/${projectId}/members/me`, { wish: 'от Веры' });
    expect((await rowOf(bob)).wish).toBe('от Бориса');
    expect((await rowOf(carol)).wish).toBe('от Веры');
  });

  it('можно очистить видео (null); пустое имя отклоняется', async () => {
    await call(bob, 'PATCH', `/projects/${projectId}/members/me`, { videoUrl: 'https://youtu.be/abc' });
    expect((await call(bob, 'PATCH', `/projects/${projectId}/members/me`, { videoUrl: null })).statusCode).toBe(200);
    expect((await rowOf(bob)).videoUrl).toBeNull();
    expect((await call(bob, 'PATCH', `/projects/${projectId}/members/me`, { childName: '' })).statusCode).toBe(400);
  });

  it('небезопасные ссылки (javascript:, http:) отклоняются', async () => {
    for (const videoUrl of ['javascript:alert(1)', 'http://x.by/v', 'ftp://x.by/v']) {
      expect((await call(bob, 'PATCH', `/projects/${projectId}/members/me`, { videoUrl })).statusCode).toBe(400);
    }
  });

  it('организатор без записи участника и посторонний получают 404, без токена — 401', async () => {
    expect((await call(alice, 'PATCH', `/projects/${projectId}/members/me`, { wish: 'x' })).statusCode).toBe(404);
    expect((await call(outsider, 'PATCH', `/projects/${projectId}/members/me`, { wish: 'x' })).statusCode).toBe(404);
    expect((await call(null, 'PATCH', `/projects/${projectId}/members/me`, { wish: 'x' })).statusCode).toBe(401);
  });

  it('в заказанном альбоме пожелание не меняется: 409', async () => {
    await db.update(projects).set({ status: 'ordered' }).where(eq(projects.id, projectId));
    const res = await call(bob, 'PATCH', `/projects/${projectId}/members/me`, { wish: 'поздно' });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('PROJECT_ORDERED');
  });

  describe('именная копия', () => {
    const crop = { x: 0, y: 0, scale: 1, rotation: 0 as const };
    const pagesOf = (layout: Layout) => layout.pages.map((p) => p.memberId ?? '-');

    async function orderedAlbum(): Promise<void> {
      const photoId = randomUUID();
      await db.insert(projectPhotos).values({ id: photoId, projectId, uploadedBy: bob.id, storagePath: `projects/${projectId}/${photoId}`, position: 0, width: 2400, height: 1600 });
      // Файла на диске нет, поэтому кладём его через хранилище приложения.
      await app.storage.put(`projects/${projectId}/${photoId}`, Buffer.from('jpeg-bytes'));
      const layout: Layout = {
        cover: { photoId, title: '11 Б', subtitle: 'Выпускной альбом' },
        pages: [
          { template: 'one', cells: [{ photoId, crop }] },
          { template: 'one', cells: [{ photoId, crop }], memberId: carol.id },
          { template: 'one', cells: [], memberId: carol.id },
          { template: 'one', cells: [{ photoId, crop }], memberId: bob.id },
          { template: 'one', cells: [], memberId: bob.id },
        ],
      };
      await db.update(projects).set({ layout, status: 'ordered' }).where(eq(projects.id, projectId));
    }

    it('personal: подзаголовок — имя ученика, его страницы идут первыми после вводной', async () => {
      await orderedAlbum();
      const res = await call(bob, 'POST', `/projects/${projectId}/duplicate`, { personal: true });
      expect(res.statusCode).toBe(201);
      const copy = projectSchema.parse(res.json());
      expect(copy.layout.cover?.subtitle).toBe('Борис');
      expect(pagesOf(copy.layout).map((id) => (id === bob.id ? 'bob' : id === carol.id ? 'carol' : '-'))).toEqual(['-', 'bob', 'bob', 'carol', 'carol']);
    });

    it('без personal макет копии прежний', async () => {
      await orderedAlbum();
      const copy = projectSchema.parse((await call(bob, 'POST', `/projects/${projectId}/duplicate`)).json());
      expect(copy.layout.cover?.subtitle).toBe('Выпускной альбом');
      expect(pagesOf(copy.layout).map((id) => (id === bob.id ? 'bob' : id === carol.id ? 'carol' : '-'))).toEqual(['-', 'carol', 'carol', 'bob', 'bob']);
    });

    it('чужой участник и посторонний не получают именную копию', async () => {
      await orderedAlbum();
      expect((await call(outsider, 'POST', `/projects/${projectId}/duplicate`, { personal: true })).statusCode).toBe(404);
    });
  });

  describe('личный разворот участника', () => {
    async function putOwn(userId: string, n: number): Promise<void> {
      for (let i = 0; i < n; i++) {
        const photoId = randomUUID();
        const key = `projects/${projectId}/${photoId}`;
        await db.insert(projectPhotos).values({
          id: photoId,
          projectId,
          uploadedBy: userId,
          storagePath: key,
          position: i,
          width: 1200,
          height: 1600,
        });
        await app.storage.put(key, Buffer.from(`jpeg-${i}`));
      }
    }

    it('создаёт личную книгу с 3 страницами (разворот) из своих фото; повтор — тот же id', async () => {
      await putOwn(bob.id, 12);
      await putOwn(carol.id, 1);
      const first = await call(bob, 'POST', `/projects/${projectId}/member-spread`);
      expect(first.statusCode).toBe(201);
      const book = projectSchema.parse(first.json());
      expect(book.sourceProjectId).toBe(projectId);
      expect(book.isShared).toBe(false);
      expect(book.ownerId).toBe(bob.id);
      expect(book.layout.pages.length).toBe(3);

      const again = projectSchema.parse((await call(bob, 'POST', `/projects/${projectId}/member-spread`)).json());
      expect(again.id).toBe(book.id);
      const photos = () => call(bob, 'GET', `/projects/${book.id}/photos`);
      expect((await photos()).json()).toHaveLength(12);

      await putOwn(bob.id, 1);
      const synced = projectSchema.parse((await call(bob, 'POST', `/projects/${projectId}/member-spread`)).json());
      expect(synced.id).toBe(book.id);
      expect(synced.layout).toEqual(book.layout);
      expect((await photos()).json()).toHaveLength(13);
    });

    it('без двух фото — 422; организатор и пул — 409; чужой — 404', async () => {
      expect((await call(bob, 'POST', `/projects/${projectId}/member-spread`)).statusCode).toBe(422);
      expect((await call(alice, 'POST', `/projects/${projectId}/member-spread`)).statusCode).toBe(409);
      expect((await call(outsider, 'POST', `/projects/${projectId}/member-spread`)).statusCode).toBe(404);
    });
  });
});
