import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { projectSchema, type Layout } from '@picpac/shared';
import { auditLog, productVariants, projectMembers, projectPhotos, projects } from '../src/db/schema.js';
import { seed, testApp } from './helpers.js';

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name));

type Session = { token: string; id: string };

function multipart(filename: string, data: Buffer, field = 'file') {
  const boundary = `----picpacTest${Math.random().toString(16).slice(2)}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, data, tail]),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('переименование и дублирование проектов', () => {
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

  const call = (
    s: Session,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url,
      payload: payload as object | undefined,
      headers: { authorization: `Bearer ${s.token}` },
    });

  const create = (s: Session, body: Record<string, unknown> = {}) =>
    call(s, 'POST', '/projects', { variantId, title: 'Лето 2026', ...body });

  const upload = (s: Session, pid: string, filename: string, data: Buffer) => {
    const m = multipart(filename, data);
    return app.inject({
      method: 'POST',
      url: `/projects/${pid}/photos`,
      payload: m.payload,
      headers: { 'content-type': m.contentType, authorization: `Bearer ${s.token}` },
    });
  };

  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => new Date();
    alice = await guest();
    bob = await guest();
    variantId = (
      await db.select().from(productVariants).where(eq(productVariants.format, 'Classic 20×20'))
    )[0]!.id;
  });

  // ─── RENAME ────────────────────────────────────────────────────────────────

  describe('PATCH /projects/:id (переименование)', () => {
    it('владелец меняет название — 200, DTO содержит новый title', async () => {
      const p = (await create(alice)).json() as { id: string };
      const res = await call(alice, 'PATCH', `/projects/${p.id}`, { title: 'Новое название' });
      expect(res.statusCode).toBe(200);
      const dto = projectSchema.parse(res.json());
      expect(dto.title).toBe('Новое название');
      expect(dto.id).toBe(p.id);
    });

    it('название обрезается по trim: "  Пробелы  " → "Пробелы"', async () => {
      const p = (await create(alice)).json() as { id: string };
      const res = await call(alice, 'PATCH', `/projects/${p.id}`, { title: '  Пробелы  ' });
      expect(res.statusCode).toBe(200);
      expect(res.json().title).toBe('Пробелы');
    });

    it('пустое название → 400', async () => {
      const p = (await create(alice)).json() as { id: string };
      const res = await call(alice, 'PATCH', `/projects/${p.id}`, { title: '   ' });
      expect(res.statusCode).toBe(400);
    });

    it('название > 200 символов → 400', async () => {
      const p = (await create(alice)).json() as { id: string };
      const res = await call(alice, 'PATCH', `/projects/${p.id}`, { title: 'A'.repeat(201) });
      expect(res.statusCode).toBe(400);
    });

    it('чужой проект → 404 с записью access.denied в аудит', async () => {
      const p = (await create(alice)).json() as { id: string };
      const res = await call(bob, 'PATCH', `/projects/${p.id}`, { title: 'Взлом' });
      expect(res.statusCode).toBe(404);
      const denied = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.userId, bob.id));
      expect(denied.some((e) => e.action === 'access.denied' && e.objectId === p.id)).toBe(true);
    });

    it('не-uuid в пути → 404', async () => {
      const res = await call(alice, 'PATCH', '/projects/not-a-uuid', { title: 'X' });
      expect(res.statusCode).toBe(404);
    });

    it('без токена → 401', async () => {
      const p = (await create(alice)).json() as { id: string };
      const res = await app.inject({ method: 'PATCH', url: `/projects/${p.id}`, payload: { title: 'X' } });
      expect(res.statusCode).toBe(401);
    });

    it('участник-организатор может переименовать общий альбом', async () => {
      const p = (
        await create(alice, { isShared: true, joinPassword: 'pass12' })
      ).json() as { id: string };
      await db
        .insert(projectMembers)
        .values({ projectId: p.id, userId: bob.id, role: 'organizer' });
      const res = await call(bob, 'PATCH', `/projects/${p.id}`, { title: 'Переименовал организатор' });
      expect(res.statusCode).toBe(200);
      expect(res.json().title).toBe('Переименовал организатор');
    });

    it('участник-contributor не может переименовать → 404', async () => {
      const p = (
        await create(alice, { isShared: true, joinPassword: 'pass12' })
      ).json() as { id: string };
      await db
        .insert(projectMembers)
        .values({ projectId: p.id, userId: bob.id, role: 'contributor' });
      const res = await call(bob, 'PATCH', `/projects/${p.id}`, { title: 'Попытка' });
      expect(res.statusCode).toBe(404);
    });
  });

  // ─── DUPLICATE ─────────────────────────────────────────────────────────────

  describe('POST /projects/:id/duplicate (дублирование)', () => {
    it('пустой проект дублируется: статус draft, title "<name> — копия", пустой макет', async () => {
      const p = (await create(alice, { title: 'Альбом' })).json() as { id: string };
      const res = await call(alice, 'POST', `/projects/${p.id}/duplicate`);
      expect(res.statusCode).toBe(201);
      const copy = projectSchema.parse(res.json());
      expect(copy.title).toBe('Альбом — копия');
      expect(copy.status).toBe('draft');
      expect(copy.id).not.toBe(p.id);
      expect(copy.ownerId).toBe(alice.id);
      expect(copy.layout).toEqual({ pages: [] });
    });

    it('дублирование с фото: фотографии копируются с новыми id, файлы физически скопированы', async () => {
      const p = (await create(alice)).json() as { id: string };
      const uploadRes = await upload(alice, p.id, 'photo-ok.jpg', fixture('photo-ok.jpg'));
      expect(uploadRes.statusCode).toBe(201);
      const photo = uploadRes.json() as { id: string };

      const res = await call(alice, 'POST', `/projects/${p.id}/duplicate`);
      expect(res.statusCode).toBe(201);
      const copy = res.json() as { id: string };

      const origPhotos = await db
        .select()
        .from(projectPhotos)
        .where(eq(projectPhotos.projectId, p.id));
      const copyPhotos = await db
        .select()
        .from(projectPhotos)
        .where(eq(projectPhotos.projectId, copy.id));
      expect(copyPhotos).toHaveLength(origPhotos.length);
      expect(copyPhotos[0]!.id).not.toBe(origPhotos[0]!.id);
      // Файл физически скопирован
      const origData = await app.storage.get(origPhotos[0]!.storagePath);
      const copyData = await app.storage.get(copyPhotos[0]!.storagePath);
      expect(origData.equals(copyData)).toBe(true);
      // storageKey должен содержать id нового проекта
      expect(copyPhotos[0]!.storagePath).toContain(copy.id);
      expect(photo.id).toBeDefined();
    });

    it('фото в макете ремаппятся: photoId в cells обновляются на новые uuid', async () => {
      const p = (await create(alice)).json() as { id: string };
      const uploadRes = await upload(alice, p.id, 'photo-ok.jpg', fixture('photo-ok.jpg'));
      const photoId = (uploadRes.json() as { id: string }).id;

      const layout: Layout = {
        pages: [
          {
            template: 'one',
            cells: [{ photoId, crop: { x: 0, y: 0, scale: 1, rotation: 0 } }],
          },
        ],
      };
      await call(alice, 'PUT', `/projects/${p.id}`, { layout, version: 1 });

      const res = await call(alice, 'POST', `/projects/${p.id}/duplicate`);
      expect(res.statusCode).toBe(201);
      const copy = projectSchema.parse(res.json());

      const copyPhotos = await db
        .select()
        .from(projectPhotos)
        .where(eq(projectPhotos.projectId, copy.id));
      const newPhotoId = copyPhotos[0]!.id;
      expect(copy.layout.pages[0]!.cells[0]!.photoId).toBe(newPhotoId);
      expect(copy.layout.pages[0]!.cells[0]!.photoId).not.toBe(photoId);
    });

    it('заказанный проект можно дублировать → 201', async () => {
      const p = (await create(alice)).json() as { id: string };
      await db.update(projects).set({ status: 'ordered' }).where(eq(projects.id, p.id));
      const res = await call(alice, 'POST', `/projects/${p.id}/duplicate`);
      expect(res.statusCode).toBe(201);
      const copy = projectSchema.parse(res.json());
      expect(copy.status).toBe('draft');
    });

    it('участник-contributor → 404', async () => {
      const p = (
        await create(alice, { isShared: true, joinPassword: 'pass12' })
      ).json() as { id: string };
      await db
        .insert(projectMembers)
        .values({ projectId: p.id, userId: bob.id, role: 'contributor' });
      const res = await call(bob, 'POST', `/projects/${p.id}/duplicate`);
      expect(res.statusCode).toBe(404);
    });

    it('участник-organizer → 404 (только владелец может дублировать)', async () => {
      const p = (
        await create(alice, { isShared: true, joinPassword: 'pass12' })
      ).json() as { id: string };
      await db
        .insert(projectMembers)
        .values({ projectId: p.id, userId: bob.id, role: 'organizer' });
      const res = await call(bob, 'POST', `/projects/${p.id}/duplicate`);
      expect(res.statusCode).toBe(404);
    });

    it('чужой проект → 404', async () => {
      const p = (await create(alice)).json() as { id: string };
      const res = await call(bob, 'POST', `/projects/${p.id}/duplicate`);
      expect(res.statusCode).toBe(404);
    });

    it('дублирование пишет project.duplicate в аудит', async () => {
      const p = (await create(alice)).json() as { id: string };
      await call(alice, 'POST', `/projects/${p.id}/duplicate`);
      const log = await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.userId, alice.id));
      expect(log.some((e) => e.action === 'project.duplicate')).toBe(true);
    });

    it('не-uuid в пути → 404', async () => {
      const res = await call(alice, 'POST', '/projects/not-a-uuid/duplicate');
      expect(res.statusCode).toBe(404);
    });

    it('без токена → 401', async () => {
      const p = (await create(alice)).json() as { id: string };
      const res = await app.inject({ method: 'POST', url: `/projects/${p.id}/duplicate` });
      expect(res.statusCode).toBe(401);
    });

    it('copy не помечает isShared: дубль всегда личный проект', async () => {
      const p = (
        await create(alice, { isShared: true, joinPassword: 'pass12' })
      ).json() as { id: string };
      const res = await call(alice, 'POST', `/projects/${p.id}/duplicate`);
      expect(res.statusCode).toBe(201);
      const copy = projectSchema.parse(res.json());
      expect(copy.isShared).toBe(false);
      expect(copy.hasPassword).toBe(false);
    });

    it('дублированный проект виден в списке у владельца', async () => {
      const p = (await create(alice)).json() as { id: string };
      const copy = (await call(alice, 'POST', `/projects/${p.id}/duplicate`)).json() as {
        id: string;
      };
      const list = (await call(alice, 'GET', '/projects')).json() as { id: string }[];
      expect(list.map((x) => x.id)).toContain(copy.id);
    });
  });
});
