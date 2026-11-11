import { randomUUID } from 'node:crypto';
import { and, count, eq, gte, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AiEditKind, AiJobDTO, AspectRatio } from '@picpac/shared';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import { aiJobs, consents, projectPhotos, projects } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { readImageMeta, sniffMime } from '../photos/imageMeta.js';
import { storageKey, toPhotoDTO } from '../photos/service.js';
import { assertProjectAccess, viewerRole } from '../projects/service.js';
import { prepareAiEgress } from './egress.js';
import { isPromptAllowed } from './promptFilter.js';
import { wrapEditPrompt } from './promptWrap.js';
import { sizeFor } from './sizeFor.js';

export const AI_HOURLY_LIMIT = 10;
const HOUR_MS = 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function acceptConsent(app: FastifyInstance, user: AuthUser): Promise<void> {
  await app.db.insert(consents).values({ userId: user.id, kind: 'ai_processing' }).onConflictDoNothing();
  await audit(app.db, { userId: user.id, action: 'ai.consent', objectType: 'profile', objectId: user.id, result: 'ok' });
}

// Отзыв согласия: после него AI снова просит согласие. Уже сделанные результаты остаются в проектах пользователя.
export async function revokeConsent(app: FastifyInstance, user: AuthUser): Promise<void> {
  const removed = await app.db
    .delete(consents)
    .where(and(eq(consents.userId, user.id), eq(consents.kind, 'ai_processing')))
    .returning({ id: consents.id });
  if (removed.length > 0) {
    await audit(app.db, { userId: user.id, action: 'ai.consent_revoked', objectType: 'profile', objectId: user.id, result: 'ok' });
  }
}

export async function requestEdit(
  app: FastifyInstance,
  user: AuthUser,
  input: { projectId: string; photoId: string; prompt: string; kind?: AiEditKind; aspect?: AspectRatio },
): Promise<{ jobId: string }> {
  const db = app.db;
  const kind: AiEditKind = input.kind ?? 'edit';
  const [consent] = await db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.userId, user.id), eq(consents.kind, 'ai_processing')));
  if (!consent) {
    throw new AppError(403, 'AI_CONSENT_REQUIRED', 'Перед обработкой нужно согласие на передачу фото во внешний сервис');
  }

  const project = await assertProjectAccess(db, user, input.projectId, 'write');
  const photo = UUID.test(input.photoId)
    ? (
        await db
          .select()
          .from(projectPhotos)
          .where(and(eq(projectPhotos.id, input.photoId), eq(projectPhotos.projectId, project.id)))
      )[0]
    : undefined;
  // Участник альбома редактирует только свои фото.
  const own = (await viewerRole(db, user, project)) !== 'contributor' || photo?.uploadedBy === user.id;
  if (!photo || !own) {
    await audit(db, { userId: user.id, action: 'access.denied', objectType: 'photo', objectId: input.photoId, result: 'denied' });
    throw new AppError(404, 'NOT_FOUND', 'Фото не найдено');
  }
  if (project.status === 'ordered') throw new AppError(409, 'PROJECT_ORDERED', 'Проект уже заказан, его фото не меняются');
  if (!isPromptAllowed(input.prompt)) {
    throw new AppError(422, 'PROMPT_REJECTED', 'Такой запрос обработать нельзя. Опишите другое изменение фото');
  }

  const wrappedPrompt = wrapEditPrompt(input.prompt, kind);
  const now = app.clock.now();
  // Лимит считается при заблокированном пользователе, поэтому параллельные запросы его не обходят.
  const job = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);
    const [{ n }] = (await tx
      .select({ n: count() })
      .from(aiJobs)
      .where(
        and(
          eq(aiJobs.userId, user.id),
          gte(aiJobs.createdAt, new Date(now.getTime() - HOUR_MS)),
          inArray(aiJobs.status, ['pending', 'done']),
        ),
      )) as [{ n: number }];
    if (n >= AI_HOURLY_LIMIT) {
      throw new AppError(429, 'AI_LIMIT', `Можно обработать не больше ${AI_HOURLY_LIMIT} фото в час. Попробуйте позже`);
    }
    const [row] = await tx
      .insert(aiJobs)
      .values({
        userId: user.id,
        projectId: project.id,
        sourcePhoto: photo.id,
        prompt: wrappedPrompt,
        size: sizeFor(input.aspect ?? 'original', photo),
        provider: app.ai.provider.name,
        createdAt: now,
      })
      .returning();
    return row!;
  });

  await audit(db, { userId: user.id, action: 'ai.edit', objectType: 'ai_job', objectId: job.id, result: 'ok' });
  enqueue(app, job.id);
  return { jobId: job.id };
}

// Задача выполняется в этом же процессе; app.ai.inflight позволяет дождаться её (тесты, остановка).
function enqueue(app: FastifyInstance, jobId: string): void {
  const task: Promise<void> = new Promise<void>((resolve) => {
    setImmediate(() => {
      runJob(app, jobId)
        .catch((e) => app.log.error(e, 'сбой AI-задачи'))
        .finally(resolve);
    });
  }).finally(() => app.ai.inflight.delete(task));
  app.ai.inflight.add(task);
}

type Failure = { reason: string };

async function runJob(app: FastifyInstance, jobId: string): Promise<void> {
  const db = app.db;
  const controller = new AbortController();
  app.ai.controllers.add(controller);
  const timer = setTimeout(() => controller.abort(), app.ai.timeoutMs);
  const fail = async ({ reason }: Failure) => {
    await db.update(aiJobs).set({ status: 'failed', reason }).where(eq(aiJobs.id, jobId));
  };
  try {
    const [job] = await db.select().from(aiJobs).where(eq(aiJobs.id, jobId));
    if (!job) return;
    const [photo] = await db.select().from(projectPhotos).where(eq(projectPhotos.id, job.sourcePhoto));
    if (!photo) return fail({ reason: 'Исходное фото уже удалено' });

    const source = await app.storage.get(photo.storagePath);
    if (!sniffMime(source)) return fail({ reason: 'Исходное фото не открывается' });

    let egress;
    try {
      egress = await prepareAiEgress(source);
    } catch (e) {
      app.log.error(e, 'не удалось подготовить фото к отправке в AI');
      return fail({ reason: 'Не удалось подготовить фото к обработке' });
    }
    await audit(db, {
      userId: job.userId,
      action: 'ai.egress',
      objectType: 'photo',
      objectId: `${photo.id}:${egress.sha256}`,
      result: 'ok',
    });

    let output: { image: Buffer; mime: string };
    try {
      output = await app.ai.provider.edit({
        image: egress.image,
        mime: egress.mime,
        prompt: job.prompt,
        size: job.size ?? undefined,
        signal: controller.signal,
      });
    } catch (e) {
      app.log.error(e, 'AI-провайдер вернул ошибку');
      return fail({
        reason: controller.signal.aborted
          ? 'Сервис не ответил вовремя, попробуйте ещё раз'
          : 'Сервис обработки фото временно недоступен, попробуйте ещё раз',
      });
    }
    let meta;
    try {
      meta = await readImageMeta(output.image);
    } catch {
      return fail({ reason: 'Сервис вернул не изображение, попробуйте ещё раз' });
    }

    const [project] = await db.select().from(projects).where(eq(projects.id, job.projectId));
    if (!project || project.status === 'ordered') return fail({ reason: 'Проект уже заказан, результат не добавлен' });

    const resultId = randomUUID();
    const key = storageKey(job.projectId, resultId);
    await app.storage.put(key, output.image);
    try {
      await db.transaction(async (tx) => {
        const [{ next }] = (await tx
          .select({ next: sql<number>`coalesce(max(${projectPhotos.position}) + 1, 0)::int` })
          .from(projectPhotos)
          .where(eq(projectPhotos.projectId, job.projectId))) as [{ next: number }];
        await tx.insert(projectPhotos).values({
          id: resultId,
          projectId: job.projectId,
          uploadedBy: job.userId,
          storagePath: key,
          position: next,
          width: meta.width,
          height: meta.height,
          takenAt: null,
          source: 'ai',
        });
        await tx
          .update(aiJobs)
          .set({ status: 'done', resultPath: key, resultPhotoId: resultId })
          .where(eq(aiJobs.id, jobId));
      });
    } catch (e) {
      await app.storage.remove(key).catch(() => undefined);
      throw e;
    }
  } catch (e) {
    app.log.error(e, 'не удалось выполнить AI-задачу');
    await fail({ reason: 'Не удалось сохранить результат, попробуйте ещё раз' }).catch(() => undefined);
  } finally {
    clearTimeout(timer);
    app.ai.controllers.delete(controller);
  }
}

export async function getJob(app: FastifyInstance, user: AuthUser, id: string): Promise<AiJobDTO> {
  const [job] = UUID.test(id)
    ? await app.db.select().from(aiJobs).where(and(eq(aiJobs.id, id), eq(aiJobs.userId, user.id)))
    : [];
  if (!job) {
    await audit(app.db, { userId: user.id, action: 'access.denied', objectType: 'ai_job', objectId: id, result: 'denied' });
    throw new AppError(404, 'NOT_FOUND', 'Задача не найдена');
  }
  const dto: AiJobDTO = { id: job.id, status: job.status };
  if (job.status === 'failed') dto.reason = job.reason ?? 'Не удалось обработать фото';
  if (job.status === 'done' && job.resultPhotoId) {
    const [photo] = await app.db.select().from(projectPhotos).where(eq(projectPhotos.id, job.resultPhotoId));
    if (photo) dto.resultPhoto = toPhotoDTO(app, photo);
  }
  return dto;
}
