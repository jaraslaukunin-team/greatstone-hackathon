import { randomUUID } from 'node:crypto';
import { asc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { PhotoDTO } from '@picpac/shared';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import { projectPhotos } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { signUrl } from '../../storage/signedUrl.js';
import { assertProjectAccess } from '../projects/service.js';
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

// Участники альбома видят только свои фото: это ограничение добавляет задача про альбомы.
export async function listPhotos(app: FastifyInstance, user: AuthUser, projectId: string): Promise<PhotoDTO[]> {
  await assertProjectAccess(app.db, user, projectId, 'read');
  const rows = await app.db
    .select()
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, projectId))
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
