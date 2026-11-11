import { createHash, randomBytes } from 'node:crypto';
import { asc, count, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AlbumProgressDTO, InviteDTO, ProjectDTO } from '@picpac/shared';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import type { Db } from '../../db/client.js';
import { projectInvites, projectMembers, projectPhotos, projects } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { assertProjectAccess, toProjectDTO } from '../projects/service.js';

export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// В базе хранится только хеш токена: утечка таблицы не даёт доступа к альбомам.
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export async function createInvite(app: FastifyInstance, user: AuthUser, projectId: string): Promise<InviteDTO> {
  const project = await assertProjectAccess(app.db, user, projectId, 'organizer');
  if (!project.isShared) throw new AppError(409, 'PROJECT_NOT_SHARED', 'Приглашать можно только в совместный альбом');
  if (project.status === 'ordered') throw new AppError(409, 'PROJECT_ORDERED', 'Альбом уже заказан');
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(app.clock.now().getTime() + INVITE_TTL_MS);
  await app.db.insert(projectInvites).values({ projectId, token: hashToken(token), expiresAt });
  await audit(app.db, { userId: user.id, action: 'album.invite', objectType: 'project', objectId: projectId, result: 'ok' });
  return { token, url: `picpac://invite/${token}`, expiresAt: expiresAt.toISOString() };
}

// Повторное принятие и принятие владельцем безопасны: строка членства не дублируется.
export async function acceptInvite(
  app: FastifyInstance,
  user: AuthUser,
  token: string,
  childName?: string,
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
  const photosOf = (userId: string) => counts.find((c) => c.userId === userId)?.photos ?? 0;
  return {
    expected: project.expectedMembers,
    members: [
      { userId: project.ownerId, childName: null, role: 'organizer', photosCount: photosOf(project.ownerId) },
      ...members.map((m) => ({
        userId: m.userId,
        childName: m.childName,
        role: m.role,
        photosCount: photosOf(m.userId),
      })),
    ],
  };
}
