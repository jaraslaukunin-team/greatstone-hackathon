import { createHash, randomBytes } from 'node:crypto';
import { and, asc, count, eq, gt, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AlbumProgressDTO, InviteDTO, ProjectDTO, UpdateMyMemberRequest } from '@picpac/shared';
import { audit } from '../../audit.js';
import { verifyPassword } from '../../auth/password.js';
import type { AuthUser } from '../../auth/plugin.js';
import type { Db } from '../../db/client.js';
import { auditLog, profiles, projectInvites, projectMembers, projectPhotos, projects } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { assertProjectAccess, toProjectDTO } from '../projects/service.js';

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// В базе хранится только хеш токена: утечка таблицы не даёт доступа к альбомам.
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export async function createInvite(
  app: FastifyInstance,
  user: AuthUser,
  projectId: string,
  baseUrl: string,
): Promise<InviteDTO> {
  const project = await assertProjectAccess(app.db, user, projectId, 'organizer');
  if (!project.isShared) throw new AppError(409, 'PROJECT_NOT_SHARED', 'Приглашать можно только в совместный альбом');
  if (project.status === 'ordered') throw new AppError(409, 'PROJECT_ORDERED', 'Альбом уже заказан');
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(app.clock.now().getTime() + INVITE_TTL_MS);
  await app.db.insert(projectInvites).values({ projectId, token: hashToken(token), expiresAt });
  await audit(app.db, { userId: user.id, action: 'album.invite', objectType: 'project', objectId: projectId, result: 'ok' });
  return { token, url: `${baseUrl.replace(/\/+$/, '')}/invite/${token}`, expiresAt: expiresAt.toISOString() };
}

const PASSWORD_WINDOW_MS = 10 * 60 * 1000;
const PASSWORD_ATTEMPTS = 5;

// Уже вступивший участник пароль не вводит. Неверные попытки считаются по журналу в окне 10 минут.
async function checkJoinPassword(
  app: FastifyInstance,
  user: AuthUser,
  inviteId: string,
  project: typeof projects.$inferSelect,
  password: string | undefined,
): Promise<void> {
  if (!project.joinPasswordHash) return;
  const [member] = await app.db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, user.id)));
  if (member) return;
  const now = app.clock.now();
  const [{ n }] = (await app.db
    .select({ n: count() })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, 'invite.password_failed'),
        eq(auditLog.objectId, inviteId),
        eq(auditLog.userId, user.id),
        gt(auditLog.at, new Date(now.getTime() - PASSWORD_WINDOW_MS)),
      ),
    )) as [{ n: number }];
  if (n >= PASSWORD_ATTEMPTS) {
    throw new AppError(429, 'TOO_MANY_ATTEMPTS', 'Слишком много неверных паролей. Попробуйте через 10 минут');
  }
  if (password === undefined) {
    throw new AppError(401, 'PASSWORD_REQUIRED', 'Для вступления в этот альбом нужен пароль от организатора');
  }
  if (!(await verifyPassword(password, project.joinPasswordHash))) {
    await audit(app.db, {
      userId: user.id,
      action: 'invite.password_failed',
      objectType: 'invite',
      objectId: inviteId,
      result: 'denied',
      at: now,
    });
    throw new AppError(401, 'PASSWORD_INVALID', 'Неверный пароль');
  }
}

// Повторное принятие и принятие владельцем безопасны: строка членства не дублируется.
export async function acceptInvite(
  app: FastifyInstance,
  user: AuthUser,
  token: string,
  childName?: string,
  password?: string,
): Promise<ProjectDTO> {
  const [invite] = await app.db.select().from(projectInvites).where(eq(projectInvites.token, hashToken(token)));
  if (!invite) throw new AppError(404, 'INVITE_UNKNOWN', 'Приглашение не найдено. Попросите организатора прислать новое');
  if (app.clock.now().getTime() >= invite.expiresAt.getTime()) {
    throw new AppError(410, 'INVITE_EXPIRED', 'Срок приглашения истёк. Попросите организатора прислать новое');
  }
  const [project] = await app.db.select().from(projects).where(eq(projects.id, invite.projectId));
  if (!project) throw new AppError(404, 'INVITE_UNKNOWN', 'Приглашение не найдено. Попросите организатора прислать новое');
  if (project.status === 'ordered') throw new AppError(409, 'PROJECT_ORDERED', 'Альбом уже заказан');
  if (project.ownerId !== user.id) {
    await checkJoinPassword(app, user, invite.id, project, password);
    const [joined] = await app.db
      .insert(projectMembers)
      .values({ projectId: project.id, userId: user.id, role: 'contributor', childName: childName ?? null })
      .onConflictDoNothing({ target: [projectMembers.projectId, projectMembers.userId] })
      .returning({ id: projectMembers.id });
    if (joined) {
      await audit(app.db, { userId: user.id, action: 'album.join', objectType: 'project', objectId: project.id, result: 'ok' });
    }
  }
  return toProjectDTO(project);
}

// Организатор (владелец) без строки в project_members идёт первым.
export async function getProgress(db: Db, user: AuthUser, projectId: string): Promise<AlbumProgressDTO> {
  const project = await assertProjectAccess(db, user, projectId, 'read');
  const [members, counts] = await Promise.all([
    db.select().from(projectMembers).where(eq(projectMembers.projectId, projectId)).orderBy(asc(projectMembers.createdAt)),
    db
      .select({ userId: projectPhotos.uploadedBy, photos: count() })
      .from(projectPhotos)
      .where(eq(projectPhotos.projectId, projectId))
      .groupBy(projectPhotos.uploadedBy),
  ]);
  const userIds = [project.ownerId, ...members.map((m) => m.userId)];
  const nameRows = await db
    .select({ id: profiles.id, displayName: profiles.displayName })
    .from(profiles)
    .where(inArray(profiles.id, userIds));
  const names = new Map(nameRows.map((r) => [r.id, r.displayName]));
  const photosOf = (userId: string) => counts.find((c) => c.userId === userId)?.photos ?? 0;
  return {
    expected: project.expectedMembers,
    members: [
      {
        userId: project.ownerId,
        childName: null,
        role: 'organizer',
        photosCount: photosOf(project.ownerId),
        wish: null,
        videoUrl: null,
        displayName: names.get(project.ownerId) ?? null,
      },
      ...members.map((m) => ({
        userId: m.userId,
        childName: m.childName,
        role: m.role,
        photosCount: photosOf(m.userId),
        wish: m.wish,
        videoUrl: m.videoUrl,
        displayName: names.get(m.userId) ?? null,
      })),
    ],
  };
}

/**
 * Участник обновляет только свою запись (путь /members/me не принимает чужой userId). Организатор без записи
 * и посторонние получают 404, заказанный альбом — 409. Пустое пожелание хранится как null.
 */
export async function updateMyMember(
  app: FastifyInstance,
  user: AuthUser,
  projectId: string,
  patch: UpdateMyMemberRequest,
): Promise<{ userId: string; childName: string | null; wish: string | null; videoUrl: string | null }> {
  const project = await assertProjectAccess(app.db, user, projectId, 'read');
  if (!project.isShared) throw new AppError(404, 'NOT_FOUND', 'Проект не найден');
  const [member] = await app.db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)));
  if (!member) throw new AppError(404, 'NOT_FOUND', 'Проект не найден');
  if (project.status === 'ordered') throw new AppError(409, 'PROJECT_ORDERED', 'Альбом уже заказан');
  const set: Partial<typeof projectMembers.$inferInsert> = {};
  if (patch.childName !== undefined) set.childName = patch.childName;
  if (patch.wish !== undefined) set.wish = patch.wish === '' ? null : patch.wish;
  if (patch.videoUrl !== undefined) set.videoUrl = patch.videoUrl;
  const [row] = Object.keys(set).length
    ? await app.db.update(projectMembers).set(set).where(eq(projectMembers.id, member.id)).returning()
    : [member];
  await audit(app.db, { userId: user.id, action: 'album.member_update', objectType: 'project', objectId: projectId, result: 'ok' });
  return { userId: row!.userId, childName: row!.childName, wish: row!.wish, videoUrl: row!.videoUrl };
}
