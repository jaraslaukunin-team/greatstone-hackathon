import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  albumProgressSchema,
  buildTimeMachineLayout,
  inviteSchema,
  orderSchema,
  projectSchema,
  quoteResponseSchema,
  type PhotoDTO,
} from '@picpac/shared';
import { productVariants, projectPhotos, projects } from '../src/db/schema.js';
import { seed, testApp } from './helpers.js';

type Session = { token: string; id: string };

const POOL_PW = 'pool-pass';

describe('общий альбом (пул): fork и sync', () => {
  let app: FastifyInstance;
  let db: Awaited<ReturnType<typeof testApp>>['db'];
  let reset: () => Promise<void>;
  let alice: Session;
  let bob: Session;
  let outsider: Session;
  let bookVariantId: string;
  let gradVariantId: string;

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
  const call = (s: Session | null, method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) =>
    app.inject({
      method,
      url,
      payload: payload as object | undefined,
      headers: s ? { authorization: `Bearer ${s.token}` } : {},
    });

  async function putPhoto(projectId: string, bytes = 'jpeg-bytes', takenAt?: Date): Promise<string> {
    const photoId = randomUUID();
    await db.insert(projectPhotos).values({
      id: photoId,
      projectId,
      uploadedBy: alice.id,
      storagePath: `projects/${projectId}/${photoId}`,
      position: 0,
      width: 2400,
      height: 1600,
      takenAt,
    });
    await app.storage.put(`projects/${projectId}/${photoId}`, Buffer.from(bytes));
    return photoId;
  }

  beforeEach(async () => {
    await reset();
    await seed(db);
    alice = await guest();
    bob = await guest();
    outsider = await guest();
    bookVariantId = (await db.select().from(productVariants).where(eq(productVariants.format, 'Classic 20×20')))[0]!
      .id;
    gradVariantId = (
      await db.select().from(productVariants).where(eq(productVariants.format, 'Выпускной 20×20'))
    )[0]!.id;
  });

  it('создание пула с паролем проходит; без пароля — 400; выпускной isPool — 400; без isShared — 400', async () => {
    expect(
      (
        await call(alice, 'POST', '/projects', {
          variantId: bookVariantId,
          title: 'Отпуск',
          isShared: true,
          isPool: true,
        })
      ).statusCode,
    ).toBe(400);

    const ok = await call(alice, 'POST', '/projects', {
      variantId: bookVariantId,
      title: 'Отпуск',
      isShared: true,
      isPool: true,
      joinPassword: POOL_PW,
    });
    expect(ok.statusCode).toBe(201);
    const pool = projectSchema.parse(ok.json());
    expect(pool.isPool).toBe(true);
    expect(pool.isShared).toBe(true);
    expect(pool.hasPassword).toBe(true);

    expect(
      (
        await call(alice, 'POST', '/projects', {
          variantId: gradVariantId,
          title: '11 Б',
          isShared: true,
          isPool: true,
          joinPassword: 'pass1',
        })
      ).statusCode,
    ).toBe(400);

    expect(
      (
        await call(alice, 'POST', '/projects', {
          variantId: bookVariantId,
          title: 'X',
          isPool: true,
          joinPassword: 'x',
        })
      ).statusCode,
    ).toBe(400);
  });

  it('участник пула видит фото всех; посторонний — 404; в выпускном — только свои', async () => {
    const poolId = (
      (await call(alice, 'POST', '/projects', {
        variantId: bookVariantId,
        title: 'Пул',
        isShared: true,
        isPool: true,
        joinPassword: POOL_PW,
      })).json() as { id: string }
    ).id;
    const inv = inviteSchema.parse((await call(alice, 'POST', `/projects/${poolId}/invites`)).json());
    expect((await call(bob, 'POST', '/invites/accept', { token: inv.token, password: POOL_PW })).statusCode).toBe(200);

    const alicePhoto = await putPhoto(poolId, 'a');
    const bobPhoto = randomUUID();
    await db.insert(projectPhotos).values({
      id: bobPhoto,
      projectId: poolId,
      uploadedBy: bob.id,
      storagePath: `projects/${poolId}/${bobPhoto}`,
      position: 1,
      width: 1000,
      height: 1000,
    });
    await app.storage.put(`projects/${poolId}/${bobPhoto}`, Buffer.from('b'));

    const bobSees = (await call(bob, 'GET', `/projects/${poolId}/photos`)).json() as PhotoDTO[];
    expect(bobSees.map((p) => p.id).sort()).toEqual([alicePhoto, bobPhoto].sort());
    expect((await call(outsider, 'GET', `/projects/${poolId}/photos`)).statusCode).toBe(404);

    const gradId = (
      (await call(alice, 'POST', '/projects', {
        variantId: gradVariantId,
        title: 'Выпуск',
        isShared: true,
        joinPassword: 'grad-pass',
      })).json() as { id: string }
    ).id;
    const gInv = inviteSchema.parse((await call(alice, 'POST', `/projects/${gradId}/invites`)).json());
    await call(bob, 'POST', '/invites/accept', { token: gInv.token, password: 'grad-pass', childName: 'Боб' });
    const onlyAlice = await putPhoto(gradId, 'g');
    const bobOwn = randomUUID();
    await db.insert(projectPhotos).values({
      id: bobOwn,
      projectId: gradId,
      uploadedBy: bob.id,
      storagePath: `projects/${gradId}/${bobOwn}`,
      position: 1,
      width: 800,
      height: 800,
    });
    await app.storage.put(`projects/${gradId}/${bobOwn}`, Buffer.from('go'));
    const gradPhotos = (await call(bob, 'GET', `/projects/${gradId}/photos`)).json() as PhotoDTO[];
    expect(gradPhotos.map((p) => p.id)).toEqual([bobOwn]);
    expect(gradPhotos.map((p) => p.id)).not.toContain(onlyAlice);
  });

  it('fork копирует фото, идемпотентен; не-пул — 409; чужой — 404', async () => {
    const poolId = (
      (await call(alice, 'POST', '/projects', {
        variantId: bookVariantId,
        title: 'Пул',
        isShared: true,
        isPool: true,
        joinPassword: POOL_PW,
      })).json() as { id: string }
    ).id;
    const inv = inviteSchema.parse((await call(alice, 'POST', `/projects/${poolId}/invites`)).json());
    await call(bob, 'POST', '/invites/accept', { token: inv.token, password: POOL_PW });
    const srcId = await putPhoto(poolId);

    const first = await call(bob, 'POST', `/projects/${poolId}/fork`);
    expect(first.statusCode).toBe(201);
    const book = projectSchema.parse(first.json());
    expect(book.sourceProjectId).toBe(poolId);
    expect(book.isPool).toBe(false);
    expect(book.ownerId).toBe(bob.id);

    const copies = await db.select().from(projectPhotos).where(eq(projectPhotos.projectId, book.id));
    expect(copies).toHaveLength(1);
    expect(copies[0]!.sourcePhotoId).toBe(srcId);
    expect(copies[0]!.storagePath).not.toBe(`projects/${poolId}/${srcId}`);
    expect(await app.storage.get(copies[0]!.storagePath)).toEqual(Buffer.from('jpeg-bytes'));

    const second = projectSchema.parse((await call(bob, 'POST', `/projects/${poolId}/fork`)).json());
    expect(second.id).toBe(book.id);

    const plain = (
      (await call(alice, 'POST', '/projects', { variantId: bookVariantId, title: 'Обычная' })).json() as {
        id: string;
      }
    ).id;
    expect((await call(alice, 'POST', `/projects/${plain}/fork`)).statusCode).toBe(409);
    expect((await call(outsider, 'POST', `/projects/${poolId}/fork`)).statusCode).toBe(404);
  });

  it('Time Machine сохраняет историю из фото пула и оформляет её в печать', async () => {
    const pool = projectSchema.parse((await call(alice, 'POST', '/projects', {
      variantId: bookVariantId,
      title: 'Наша история',
      isShared: true,
      isPool: true,
      joinPassword: POOL_PW,
    })).json());
    await putPhoto(pool.id, 'early-frame', new Date('2015-09-01T12:00:00Z'));
    await putPhoto(pool.id, 'later-frame', new Date('2025-06-10T12:00:00Z'));

    const book = projectSchema.parse((await call(alice, 'POST', `/projects/${pool.id}/fork`)).json());
    const photos: PhotoDTO[] = (await call(alice, 'GET', `/projects/${book.id}/photos`)).json();
    const variant = (await db.select().from(productVariants).where(eq(productVariants.id, book.variantId)))[0]!;
    const { layout } = buildTimeMachineLayout(
      photos.map((photo) => ({ ...photo, authorName: null })),
      { title: book.title, limits: variant },
    );

    const update = await call(alice, 'PUT', `/projects/${book.id}`, { version: book.version, layout });
    expect(update.statusCode).toBe(200);
    const saved = projectSchema.parse((await call(alice, 'GET', `/projects/${book.id}`)).json());
    expect(saved.layout).toEqual(layout);
    expect(saved.layout.pages.filter((page) => page.texts?.some((text) => text.style === 'quote'))).toHaveLength(2);

    const quote = quoteResponseSchema.parse((await call(alice, 'POST', '/price-quote', {
      variantId: book.variantId,
      pages: saved.layout.pages.length,
      quantity: 1,
      delivery: 'belpost',
    })).json());
    const ordered = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${alice.token}`, 'idempotency-key': randomUUID() },
      payload: {
        projectId: book.id,
        delivery: 'belpost',
        expectedTotalKop: quote.totalKop,
        address: { recipient: 'Тест Тестов', phone: '+375291234567', city: 'Минск', street: 'Тестовая, 1' },
      },
    });
    expect(ordered.statusCode).toBe(201);
    expect(orderSchema.parse(ordered.json())).toMatchObject({ projectId: book.id, totalKop: quote.totalKop });
  });

  it('sync добавляет только новые; повтор пустой; чужая книга 404; заказанная 409', async () => {
    const poolId = (
      (await call(alice, 'POST', '/projects', {
        variantId: bookVariantId,
        title: 'Пул',
        isShared: true,
        isPool: true,
        joinPassword: POOL_PW,
      })).json() as { id: string }
    ).id;
    const inv = inviteSchema.parse((await call(alice, 'POST', `/projects/${poolId}/invites`)).json());
    await call(bob, 'POST', '/invites/accept', { token: inv.token, password: POOL_PW });
    await putPhoto(poolId, 'one');
    const book = projectSchema.parse((await call(bob, 'POST', `/projects/${poolId}/fork`)).json());

    const newId = randomUUID();
    await db.insert(projectPhotos).values({
      id: newId,
      projectId: poolId,
      uploadedBy: alice.id,
      storagePath: `projects/${poolId}/${newId}`,
      position: 1,
      width: 1200,
      height: 900,
    });
    await app.storage.put(`projects/${poolId}/${newId}`, Buffer.from('two'));

    const synced = await call(bob, 'POST', `/projects/${book.id}/sync`);
    expect(synced.statusCode).toBe(200);
    const { added } = synced.json() as { added: PhotoDTO[] };
    expect(added).toHaveLength(1);
    expect(added[0]!.id).not.toBe(newId);

    const again = (await call(bob, 'POST', `/projects/${book.id}/sync`)).json() as { added: PhotoDTO[] };
    expect(again.added).toHaveLength(0);

    expect((await call(outsider, 'POST', `/projects/${book.id}/sync`)).statusCode).toBe(404);

    await db.update(projects).set({ status: 'ordered' }).where(eq(projects.id, book.id));
    expect((await call(bob, 'POST', `/projects/${book.id}/sync`)).statusCode).toBe(409);
  });

  it('заказ пула — 409 POOL_NOT_ORDERABLE; progress содержит displayName', async () => {
    const poolId = (
      (await call(alice, 'POST', '/projects', {
        variantId: bookVariantId,
        title: 'Пул',
        isShared: true,
        isPool: true,
        joinPassword: POOL_PW,
      })).json() as { id: string }
    ).id;
    const order = await app.inject({
      method: 'POST',
      url: '/orders',
      headers: { authorization: `Bearer ${alice.token}`, 'idempotency-key': randomUUID() },
      payload: {
        projectId: poolId,
        delivery: 'belpost',
        expectedTotalKop: 10000,
        address: { recipient: 'A', phone: '+375291111111', city: 'Минск', street: 'ул. 1' },
        payment: 'card',
      },
    });
    expect(order.statusCode).toBe(409);
    expect(order.json().error.code).toBe('POOL_NOT_ORDERABLE');

    const progress = albumProgressSchema.parse((await call(alice, 'GET', `/projects/${poolId}/progress`)).json());
    expect(progress.members[0]?.displayName).toBeTruthy();
  });
});
