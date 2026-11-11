import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { photoSchema } from '@picpac/shared';
import { auditLog, orders, productVariants, projectPhotos, projects } from '../src/db/schema.js';
import { DiskStorage } from '../src/storage/diskStorage.js';
import { signUrl, verifySignature } from '../src/storage/signedUrl.js';
import { seed, testApp } from './helpers.js';

const fixture = (name: string) => readFileSync(join(__dirname, '..', 'fixtures', name));
const SECRET = 'unit-secret';

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

describe('подписанные ссылки', () => {
  const photoId = '11111111-1111-4111-8111-111111111111';
  const now = new Date('2026-11-11T12:00:00Z');
  const exp = (d: Date) => Math.floor(d.getTime() / 1000);
  const parts = (url: string) => {
    const u = new URL(url, 'http://x');
    return { id: u.pathname.split('/').pop()!, exp: Number(u.searchParams.get('exp')), sig: u.searchParams.get('sig')! };
  };

  it('подпись проходит до истечения и не проходит после него', () => {
    const url = signUrl(photoId, new Date(now.getTime() + 3600_000), SECRET);
    expect(url.startsWith(`/files/${photoId}?exp=`)).toBe(true);
    const p = parts(url);
    expect(verifySignature(p.id, p.exp, p.sig, SECRET, now)).toBe(true);
    expect(verifySignature(p.id, p.exp, p.sig, SECRET, new Date(p.exp * 1000))).toBe(false);
    expect(verifySignature(p.id, p.exp, p.sig, SECRET, new Date(p.exp * 1000 + 1000))).toBe(false);
  });

  it('чужой секрет, другой id, другой срок и испорченная подпись не проходят', () => {
    const p = parts(signUrl(photoId, new Date(now.getTime() + 3600_000), SECRET));
    expect(verifySignature(p.id, p.exp, p.sig, 'other-secret', now)).toBe(false);
    expect(verifySignature('22222222-2222-4222-8222-222222222222', p.exp, p.sig, SECRET, now)).toBe(false);
    expect(verifySignature(p.id, p.exp + 1, p.sig, SECRET, now)).toBe(false);
    const flipped = `${p.sig.slice(0, -1)}${p.sig.endsWith('0') ? '1' : '0'}`;
    expect(verifySignature(p.id, p.exp, flipped, SECRET, now)).toBe(false);
    expect(verifySignature(p.id, p.exp, 'zz', SECRET, now)).toBe(false);
    expect(exp(now)).toBeGreaterThan(0);
  });
});

describe('хранилище на диске', () => {
  it('кладёт, читает и удаляет файл; удаление отсутствующего не падает', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const storage = new DiskStorage(mkdtempSync(join(tmpdir(), 'picpac-disk-')));
    await storage.put('projects/p/a', Buffer.from('abc'));
    expect((await storage.get('projects/p/a')).toString()).toBe('abc');
    await storage.remove('projects/p/a');
    await expect(storage.get('projects/p/a')).rejects.toThrow();
    await expect(storage.remove('projects/p/a')).resolves.toBeUndefined();
  });

  it('ключ, выходящий за корневую папку, отвергается', async () => {
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const storage = new DiskStorage(mkdtempSync(join(tmpdir(), 'picpac-disk-')));
    await expect(storage.put('../evil', Buffer.from('x'))).rejects.toThrow();
    await expect(storage.get('projects/../../evil')).rejects.toThrow();
  });
});

describe('фото проекта', () => {
  let app: FastifyInstance;
  let db: Awaited<ReturnType<typeof testApp>>['db'];
  let reset: () => Promise<void>;
  let alice: Session;
  let bob: Session;
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
  const upload = (s: Session | null, pid: string, filename: string, data: Buffer, field = 'file') => {
    const m = multipart(filename, data, field);
    return app.inject({
      method: 'POST',
      url: `/projects/${pid}/photos`,
      payload: m.payload,
      headers: { 'content-type': m.contentType, ...(s ? { authorization: `Bearer ${s.token}` } : {}) },
    });
  };
  const call = (s: Session, method: 'GET' | 'DELETE', url: string) =>
    app.inject({ method, url, headers: { authorization: `Bearer ${s.token}` } });
  const rows = (pid = projectId) => db.select().from(projectPhotos).where(eq(projectPhotos.projectId, pid));

  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => new Date('2026-11-11T12:00:00Z');
    alice = await guest();
    bob = await guest();
    const variantId = (await db.select().from(productVariants).where(eq(productVariants.format, 'Classic 20×20')))[0]!.id;
    projectId = (
      (await app.inject({
        method: 'POST',
        url: '/projects',
        payload: { variantId, title: 'Поездка' },
        headers: { authorization: `Bearer ${alice.token}` },
      })).json() as { id: string }
    ).id;
  });

  it('JPEG загружается: размеры 2400×1600, дата съёмки из EXIF, файл лежит в хранилище', async () => {
    const res = await upload(alice, projectId, 'photo-ok.jpg', fixture('photo-ok.jpg'));
    expect(res.statusCode).toBe(201);
    const photo = photoSchema.parse(res.json());
    expect(photo).toMatchObject({
      width: 2400,
      height: 1600,
      takenAt: '2024-06-15T12:30:00.000Z',
      uploadedBy: alice.id,
      source: 'gallery',
    });
    expect(photo.url.startsWith(`/files/${photo.id}?exp=`)).toBe(true);
    const [row] = await rows();
    expect(row!.storagePath).toBe(`projects/${projectId}/${photo.id}`);
    expect((await app.storage.get(row!.storagePath)).equals(fixture('photo-ok.jpg'))).toBe(true);
  });

  it('вертикальное фото с EXIF-ориентацией 6 возвращает 1600×2400, а не сырые 2400×1600', async () => {
    const res = await upload(alice, projectId, 'phone.jpg', fixture('photo-exif-rotated.jpg'));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ width: 1600, height: 2400 });
  });

  it('PNG принимается, даты съёмки нет', async () => {
    const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#888888' } }).png().toBuffer();
    const res = await upload(alice, projectId, 'shot.png', png);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ width: 300, height: 200, takenAt: null });
  });

  it('GIF с расширением .jpg и оборванный JPEG: 415 FORMAT_UNSUPPORTED, ничего не сохраняется', async () => {
    const gif = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00;', 'binary');
    const bad = await upload(alice, projectId, 'x.jpg', gif);
    expect(bad.statusCode).toBe(415);
    expect(bad.json().error.code).toBe('FORMAT_UNSUPPORTED');
    expect(bad.json().error.message).toContain('JPEG');
    const broken = await upload(alice, projectId, 'y.jpg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]));
    expect(broken.statusCode).toBe(415);
    expect(await rows()).toHaveLength(0);
  });

  it('файл больше 15 МБ: 413 FILE_TOO_LARGE, в тексте назван лимит', async () => {
    const big = Buffer.concat([fixture('photo-ok.jpg'), Buffer.alloc(15 * 1024 * 1024)]);
    const res = await upload(alice, projectId, 'big.jpg', big);
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe('FILE_TOO_LARGE');
    expect(res.json().error.message).toContain('15');
    expect(await rows()).toHaveLength(0);
  });

  it('запрос без файла: 400, без токена: 401', async () => {
    const res = await upload(alice, projectId, 'a.jpg', fixture('photo-ok.jpg'), 'other');
    expect(res.statusCode).toBe(400);
    expect((await upload(null, projectId, 'a.jpg', fixture('photo-ok.jpg'))).statusCode).toBe(401);
  });

  it('чужой пользователь не может загрузить фото в чужой проект: 404 и запись в журнал', async () => {
    const res = await upload(bob, projectId, 'a.jpg', fixture('photo-ok.jpg'));
    expect(res.statusCode).toBe(404);
    expect(await rows()).toHaveLength(0);
    const denied = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.userId, bob.id), eq(auditLog.action, 'access.denied')));
    expect(denied).toHaveLength(1);
  });

  it('в заказанный проект фото не добавляются: 409 PROJECT_ORDERED', async () => {
    await db.update(projects).set({ status: 'ordered' }).where(eq(projects.id, projectId));
    const res = await upload(alice, projectId, 'a.jpg', fixture('photo-ok.jpg'));
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('PROJECT_ORDERED');
  });

  it('позиции растут по порядку загрузки, список отдаёт их с подписанными ссылками', async () => {
    await upload(alice, projectId, '1.jpg', fixture('photo-ok.jpg'));
    await upload(alice, projectId, '2.jpg', fixture('photo-small.jpg'));
    expect((await rows()).map((r) => r.position).sort()).toEqual([0, 1]);
    const list = await call(alice, 'GET', `/projects/${projectId}/photos`);
    expect(list.statusCode).toBe(200);
    const photos = (list.json() as unknown[]).map((p) => photoSchema.parse(p));
    expect(photos.map((p) => p.width)).toEqual([2400, 700]);
    expect((await call(bob, 'GET', `/projects/${projectId}/photos`)).statusCode).toBe(404);
  });

  it('файл отдаётся по подписанной ссылке без токена; испорченная и истёкшая ссылки дают 403', async () => {
    const photo = photoSchema.parse((await upload(alice, projectId, 'a.jpg', fixture('photo-ok.jpg'))).json());
    const ok = await app.inject({ method: 'GET', url: photo.url });
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['content-type']).toBe('image/jpeg');
    expect(ok.rawPayload.equals(fixture('photo-ok.jpg'))).toBe(true);

    const tampered = await app.inject({ method: 'GET', url: photo.url.replace(/sig=(.)/, (_, c) => `sig=${c === 'a' ? 'b' : 'a'}`) });
    expect(tampered.statusCode).toBe(403);
    app.clock.now = () => new Date('2026-11-11T13:01:00Z');
    const expired = await app.inject({ method: 'GET', url: photo.url });
    expect(expired.statusCode).toBe(403);
    expect(expired.json().error.code).toBe('FORBIDDEN');
  });

  it('удаление: владелец удаляет строку и файл, чужой получает 404 и ничего не теряется', async () => {
    const photo = photoSchema.parse((await upload(alice, projectId, 'a.jpg', fixture('photo-ok.jpg'))).json());
    const key = `projects/${projectId}/${photo.id}`;
    expect((await call(bob, 'DELETE', `/photos/${photo.id}`)).statusCode).toBe(404);
    expect(await rows()).toHaveLength(1);
    expect((await call(alice, 'DELETE', `/photos/${photo.id}`)).statusCode).toBe(204);
    expect(await rows()).toHaveLength(0);
    await expect(app.storage.get(key)).rejects.toThrow();
    expect((await call(alice, 'DELETE', `/photos/${photo.id}`)).statusCode).toBe(404);
  });

  it('из заказанного проекта фото не удаляется: 409', async () => {
    const photo = photoSchema.parse((await upload(alice, projectId, 'a.jpg', fixture('photo-ok.jpg'))).json());
    await db.insert(orders).values({
      customerId: alice.id,
      projectId,
      idempotencyKey: 'k',
      requestHash: 'h',
      total: 1,
      deliveryMethod: 'ems',
    });
    await db.update(projects).set({ status: 'ordered' }).where(eq(projects.id, projectId));
    const res = await call(alice, 'DELETE', `/photos/${photo.id}`);
    expect(res.statusCode).toBe(409);
    expect(await rows()).toHaveLength(1);
  });

  it('удаление проекта удаляет и файлы его фото', async () => {
    const a = photoSchema.parse((await upload(alice, projectId, 'a.jpg', fixture('photo-ok.jpg'))).json());
    const b = photoSchema.parse((await upload(alice, projectId, 'b.jpg', fixture('photo-small.jpg'))).json());
    expect((await call(alice, 'DELETE', `/projects/${projectId}`)).statusCode).toBe(204);
    await expect(app.storage.get(`projects/${projectId}/${a.id}`)).rejects.toThrow();
    await expect(app.storage.get(`projects/${projectId}/${b.id}`)).rejects.toThrow();
  });

  describe('копирование фото между проектами', () => {
    const newProject = async (s: Session) => {
      const variantId = (await db.select().from(productVariants).where(eq(productVariants.format, 'Classic 20×20')))[0]!.id;
      return (
        (await app.inject({
          method: 'POST',
          url: '/projects',
          payload: { variantId, title: 'Печать' },
          headers: { authorization: `Bearer ${s.token}` },
        })).json() as { id: string }
      ).id;
    };
    const copy = (s: Session, target: string, fromPhotoId: string) =>
      app.inject({
        method: 'POST',
        url: `/projects/${target}/photos/copy`,
        payload: { fromPhotoId },
        headers: { authorization: `Bearer ${s.token}` },
      });

    it('копия в свой проект: 201, новый id, те же размеры и источник, файл открывается', async () => {
      const src = (await upload(alice, projectId, 'photo-ok.jpg', fixture('photo-ok.jpg'))).json() as { id: string };
      await db.update(projectPhotos).set({ source: 'ai' }).where(eq(projectPhotos.id, src.id));
      const target = await newProject(alice);
      const res = await copy(alice, target, src.id);
      expect(res.statusCode).toBe(201);
      const dto = photoSchema.parse(res.json());
      expect(dto.id).not.toBe(src.id);
      expect(dto.width).toBe(2400);
      expect(dto.height).toBe(1600);
      expect(dto.source).toBe('ai');
      expect((await app.inject({ method: 'GET', url: dto.url })).statusCode).toBe(200);
      expect(await rows(target)).toHaveLength(1);
    });

    it('удаление исходного проекта не ломает копию', async () => {
      const src = (await upload(alice, projectId, 'photo-ok.jpg', fixture('photo-ok.jpg'))).json() as { id: string };
      const target = await newProject(alice);
      const dto = (await copy(alice, target, src.id)).json() as { url: string };
      expect((await call(alice, 'DELETE', `/projects/${projectId}`)).statusCode).toBe(204);
      expect((await app.inject({ method: 'GET', url: dto.url })).statusCode).toBe(200);
    });

    it('чужое фото, чужой целевой проект и не-uuid: 404 и запись access.denied; файл не копируется', async () => {
      const src = (await upload(alice, projectId, 'photo-ok.jpg', fixture('photo-ok.jpg'))).json() as { id: string };
      const bobs = await newProject(bob);
      expect((await copy(bob, bobs, src.id)).statusCode).toBe(404);
      expect((await copy(bob, projectId, src.id)).statusCode).toBe(404);
      expect((await copy(alice, bobs, src.id)).statusCode).toBe(404);
      expect((await copy(alice, projectId, 'not-a-uuid')).statusCode).toBe(404);
      expect(await rows(bobs)).toHaveLength(0);
      const denied = await db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.userId, bob.id), eq(auditLog.action, 'access.denied')));
      expect(denied.length).toBeGreaterThan(0);
    });

    it('в заказанный проект копировать нельзя: 409', async () => {
      const src = (await upload(alice, projectId, 'photo-ok.jpg', fixture('photo-ok.jpg'))).json() as { id: string };
      const target = await newProject(alice);
      await db.update(projects).set({ status: 'ordered' }).where(eq(projects.id, target));
      const res = await copy(alice, target, src.id);
      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('PROJECT_ORDERED');
    });
  });
});
