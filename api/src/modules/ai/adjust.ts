import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import type { PhotoDTO } from '@picpac/shared';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import { projectPhotos, projects } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { readImageMeta } from '../photos/imageMeta.js';
import { storageKey, toPhotoDTO } from '../photos/service.js';
import { assertProjectAccess, viewerRole } from '../projects/service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdjustInput = {
  projectId: string;
  photoId: string;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpen?: number;
};

export async function applyAdjust(
  app: FastifyInstance,
  user: AuthUser,
  input: AdjustInput,
): Promise<PhotoDTO> {
  const hasChange =
    input.brightness !== undefined ||
    input.contrast !== undefined ||
    input.saturation !== undefined ||
    (input.sharpen !== undefined && input.sharpen > 0);
  if (!hasChange) {
    throw new AppError(422, 'NO_ADJUSTMENTS', 'Укажите хотя бы один параметр изменения');
  }

  const project = await assertProjectAccess(app.db, user, input.projectId, 'write');
  if (project.status === 'ordered') {
    throw new AppError(409, 'PROJECT_ORDERED', 'Проект уже заказан, его фото не меняются');
  }

  const photo = UUID.test(input.photoId)
    ? (
        await app.db
          .select()
          .from(projectPhotos)
          .where(and(eq(projectPhotos.id, input.photoId), eq(projectPhotos.projectId, project.id)))
      )[0]
    : undefined;
  const own = (await viewerRole(app.db, user, project)) !== 'contributor' || photo?.uploadedBy === user.id;
  if (!photo || !own) {
    await audit(app.db, {
      userId: user.id,
      action: 'access.denied',
      objectType: 'photo',
      objectId: input.photoId,
      result: 'denied',
    });
    throw new AppError(404, 'NOT_FOUND', 'Фото не найдено');
  }

  const source = await app.storage.get(photo.storagePath);
  let pipeline = sharp(source);
  const brightness = input.brightness ?? 1;
  const saturation = input.saturation ?? 1;
  if (brightness !== 1 || saturation !== 1) {
    pipeline = pipeline.modulate({ brightness, saturation });
  }
  const contrast = input.contrast ?? 1;
  if (contrast !== 1) {
    // linear: output = input * a + b; contrast around midpoint 128
    const a = contrast;
    const b = 128 * (1 - contrast);
    pipeline = pipeline.linear(a, b);
  }
  if (input.sharpen !== undefined && input.sharpen > 0) {
    pipeline = pipeline.sharpen({ sigma: Math.min(input.sharpen, 5) });
  }

  const output = await pipeline.jpeg({ quality: 90 }).toBuffer();
  const meta = await readImageMeta(output);
  const resultId = randomUUID();
  const key = storageKey(input.projectId, resultId);

  await app.storage.put(key, output);
  try {
    const [{ next }] = (await app.db
      .select({ next: sql<number>`coalesce(max(${projectPhotos.position}) + 1, 0)::int` })
      .from(projectPhotos)
      .where(eq(projectPhotos.projectId, input.projectId))) as [{ next: number }];

    const [row] = await app.db
      .insert(projectPhotos)
      .values({
        id: resultId,
        projectId: input.projectId,
        uploadedBy: user.id,
        storagePath: key,
        position: next,
        width: meta.width,
        height: meta.height,
        takenAt: null,
        source: 'ai',
      })
      .returning();

    await audit(app.db, {
      userId: user.id,
      action: 'ai.adjust',
      objectType: 'photo',
      objectId: resultId,
      result: 'ok',
    });

    // touch project updatedAt for sync clients
    await app.db
      .update(projects)
      .set({ updatedAt: app.clock.now() })
      .where(eq(projects.id, input.projectId));

    return toPhotoDTO(app, row!);
  } catch (e) {
    await app.storage.remove(key).catch(() => undefined);
    throw e;
  }
}
