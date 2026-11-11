import { randomUUID } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { PhotoDTO } from '@picpac/shared';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import { projectPhotos } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { signUrl } from '../../storage/signedUrl.js';
import { assertProjectAccess, viewerRole } from '../projects/service.js';
import { readImageMeta } from './imageMeta.js';

type PhotoRow = typeof projectPhotos.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_TTL_MS = 60 * 60 * 1000;
const notFound = () => new AppError(404, 'NOT_FOUND', 'Фото не найдено');
const ordered = () => new AppError(409, 'PROJECT_ORDERED', 'Проект уже заказан, его фото не меняются');

export const storageKey = (projectId: string, photoId: string) => `projects/${projectId}/${photoId}`;

export function toPhotoDTO(app: FastifyInstance, row: PhotoRow): PhotoDTO {
  const expiresAt = new Date(app.clock.now().getTime() + LINK_TTL_MS);
  return {
    id: row.id,
    width: row.width,
    height: row.height,
    takenAt: row.takenAt ? row.takenAt.toISOString() : null,
    url: signUrl(row.id, expiresAt, app.config.fileUrlSecret),
    uploadedBy: row.uploadedBy,
    source: row.source,
  };
}

export async function addPhoto(
  app: FastifyInstance,
  user: AuthUser,
  projectId: string,
  data: Buffer,
): Promise<PhotoDTO> {
  const project = await assertProjectAccess(app.db, user, projectId, 'write');
  if (project.status === 'ordered') throw ordered();
  const meta = await readImageMeta(data);

  const [{ next }] = (await app.db
    .select({ next: sql<number>`coalesce(max(${projectPhotos.position}) + 1, 0)::int` })
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, projectId))) as [{ next: number }];

  const id = randomUUID();
  const key = storageKey(projectId, id);
  await app.storage.put(key, data);
  try {
    const [row] = await app.db
      .insert(projectPhotos)
      .values({
        id,
        projectId,
        uploadedBy: user.id,
        storagePath: key,
        position: next,
        width: meta.width,
        height: meta.height,
        takenAt: meta.takenAt,
      })
      .returning();
    await audit(app.db, { userId: user.id, action: 'photo.upload', objectType: 'photo', objectId: id, result: 'ok' });
    return toPhotoDTO(app, row!);
  } catch (e) {
    await app.storage.remove(key).catch(() => undefined);
    throw e;
  }
}

/**
 * Копирует фото в другой проект пользователя (например, результат AI в проект печати).
 * Файл копируется физически: удаление исходного проекта не ломает копию.
 */
export async function copyPhoto(
  app: FastifyInstance,
  user: AuthUser,
  targetProjectId: string,
  fromPhotoId: string,
): Promise<PhotoDTO> {
  const target = await assertProjectAccess(app.db, user, targetProjectId, 'write');
  const deny = async () => {
    await audit(app.db, { userId: user.id, action: 'access.denied', objectType: 'photo', objectId: fromPhotoId, result: 'denied' });
    return notFound();
  };
  if (!UUID.test(fromPhotoId)) throw await deny();
  const [src] = await app.db.select().from(projectPhotos).where(eq(projectPhotos.id, fromPhotoId));
  if (!src) throw await deny();
  const source = await assertProjectAccess(app.db, user, src.projectId, 'read');
  // Участник альбома копирует только свои фото, как и видит только свои.
  if ((await viewerRole(app.db, user, source)) === 'contributor' && src.uploadedBy !== user.id) throw await deny();
  if (target.status === 'ordered') throw ordered();

  const data = await app.storage.get(src.storagePath);
  const [{ next }] = (await app.db
    .select({ next: sql<number>`coalesce(max(${projectPhotos.position}) + 1, 0)::int` })
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, targetProjectId))) as [{ next: number }];
  const id = randomUUID();
  const key = storageKey(targetProjectId, id);
  await app.storage.put(key, data);
  try {
    const [row] = await app.db
      .insert(projectPhotos)
      .values({
        id,
        projectId: targetProjectId,
        uploadedBy: user.id,
        storagePath: key,
        position: next,
        width: src.width,
        height: src.height,
        takenAt: src.takenAt,
        source: src.source,
      })
      .returning();
    await audit(app.db, { userId: user.id, action: 'photo.copy', objectType: 'photo', objectId: id, result: 'ok' });
    return toPhotoDTO(app, row!);
  } catch (e) {
    await app.storage.remove(key).catch(() => undefined);
    throw e;
  }
}

// Участник альбома видит только свои фото; владелец, организатор и оператор видят все.
export async function listPhotos(app: FastifyInstance, user: AuthUser, projectId: string): Promise<PhotoDTO[]> {
  const project = await assertProjectAccess(app.db, user, projectId, 'read');
  const role = await viewerRole(app.db, user, project);
  const own = role === 'contributor' ? eq(projectPhotos.uploadedBy, user.id) : undefined;
  const rows = await app.db
    .select()
    .from(projectPhotos)
    .where(and(eq(projectPhotos.projectId, projectId), own))
    .orderBy(asc(projectPhotos.position), asc(projectPhotos.createdAt));
  return rows.map((r) => toPhotoDTO(app, r));
}

export async function deletePhoto(app: FastifyInstance, user: AuthUser, photoId: string): Promise<void> {
  if (!UUID.test(photoId)) throw notFound();
  const [photo] = await app.db.select().from(projectPhotos).where(eq(projectPhotos.id, photoId));
  if (!photo) throw notFound();
  const project = await assertProjectAccess(app.db, user, photo.projectId, 'write');
  // Чужие фото вправе удалять только владелец проекта и организатор альбома.
  if (photo.uploadedBy !== user.id) await assertProjectAccess(app.db, user, photo.projectId, 'organizer');
  if (project.status === 'ordered') throw ordered();
  await app.db.delete(projectPhotos).where(eq(projectPhotos.id, photoId));
  await app.storage.remove(photo.storagePath).catch((e) => app.log.error(e, 'не удалось удалить файл фото'));
  await audit(app.db, { userId: user.id, action: 'photo.delete', objectType: 'photo', objectId: photoId, result: 'ok' });
}

export async function loadPhotoFile(
  app: FastifyInstance,
  photoId: string,
): Promise<{ data: Buffer } | null> {
  if (!UUID.test(photoId)) return null;
  const [photo] = await app.db.select().from(projectPhotos).where(eq(projectPhotos.id, photoId));
  if (!photo) return null;
  try {
    return { data: await app.storage.get(photo.storagePath) };
  } catch {
    return null;
  }
}
