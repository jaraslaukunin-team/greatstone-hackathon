import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { Layout, ProjectDTO } from '@picpac/shared';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import type { Db } from '../../db/client.js';
import { orders, projectMembers, projectPhotos, projects } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import type { Storage } from '../../storage/storage.js';
import { loadVariant } from '../quote/service.js';

export type ProjectRow = typeof projects.$inferSelect;
export type ProjectNeed = 'read' | 'write' | 'organizer';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new AppError(404, 'NOT_FOUND', 'Проект не найден');

export const toProjectDTO = (p: ProjectRow): ProjectDTO => ({
  id: p.id,
  title: p.title,
  variantId: p.variantId,
  ownerId: p.ownerId,
  status: p.status,
  isShared: p.isShared,
  expectedMembers: p.expectedMembers,
  layout: (p.layout as Layout | null) ?? { pages: [] },
  version: p.version,
  updatedAt: p.updatedAt.toISOString(),
});

// 'read': владелец, участник альбома, оператор (только если по проекту есть заказ).
// 'write': владелец и участники (добавление фото). 'organizer': владелец и организатор альбома.
// Любой отказ (в том числе несуществующий проект) пишется в журнал и выглядит как 404.
export async function assertProjectAccess(
  db: Db,
  user: AuthUser,
  projectId: string,
  need: ProjectNeed,
): Promise<ProjectRow> {
  if (!UUID.test(projectId)) throw notFound();
  const refuse = async (): Promise<never> => {
    await audit(db, {
      userId: user.id,
      action: 'access.denied',
      objectType: 'project',
      objectId: projectId,
      result: 'denied',
    });
    throw notFound();
  };
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return refuse();
  if (project.ownerId === user.id) return project;

  const [member] = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)));
  if (member) {
    if (member.role === 'organizer') return project;
    if (need !== 'organizer') return project;
    return refuse();
  }

  if (user.role === 'operator' && need === 'read') {
    const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.projectId, projectId)).limit(1);
    if (order) return project;
  }
  return refuse();
}

export type ViewerRole = 'owner' | 'organizer' | 'contributor' | 'operator';

// Кем пользователь приходится проекту (владелец неявный организатор альбома).
export async function viewerRole(db: Db, user: AuthUser, project: ProjectRow): Promise<ViewerRole | null> {
  if (project.ownerId === user.id) return 'owner';
  const [member] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, user.id)));
  if (member) return member.role;
  return user.role === 'operator' ? 'operator' : null;
}

export async function createProject(
  db: Db,
  user: AuthUser,
  input: { variantId: string; title: string; isShared?: boolean; expectedMembers?: number },
): Promise<ProjectDTO> {
  await loadVariant(db, input.variantId);
  const [row] = await db
    .insert(projects)
    .values({
      ownerId: user.id,
      variantId: input.variantId,
      title: input.title,
      isShared: input.isShared ?? false,
      expectedMembers: input.expectedMembers ?? null,
    })
    .returning();
  await audit(db, { userId: user.id, action: 'project.create', objectType: 'project', objectId: row!.id, result: 'ok' });
  return toProjectDTO(row!);
}

export async function listProjects(db: Db, user: AuthUser): Promise<ProjectDTO[]> {
  const memberOf = db
    .select({ id: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, user.id));
  const rows = await db
    .select()
    .from(projects)
    .where(or(eq(projects.ownerId, user.id), inArray(projects.id, memberOf)))
    .orderBy(desc(projects.updatedAt));
  return rows.map(toProjectDTO);
}

// Оптимистичная блокировка: UPDATE проходит только при совпадении версии и статуса draft.
export async function saveLayout(
  db: Db,
  user: AuthUser,
  projectId: string,
  layout: Layout,
  version: number,
): Promise<{ version: number }> {
  await assertProjectAccess(db, user, projectId, 'organizer');
  const [updated] = await db
    .update(projects)
    .set({ layout, version: version + 1, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.version, version), eq(projects.status, 'draft')))
    .returning({ version: projects.version });
  if (updated) return updated;
  const [current] = await db.select({ status: projects.status }).from(projects).where(eq(projects.id, projectId));
  if (current?.status === 'ordered') {
    throw new AppError(409, 'PROJECT_ORDERED', 'Проект уже заказан и больше не меняется');
  }
  throw new AppError(409, 'VERSION_CONFLICT', 'Проект изменён в другом месте, обновите его и повторите');
}

export async function deleteProject(db: Db, storage: Storage, user: AuthUser, projectId: string): Promise<void> {
  const project = await assertProjectAccess(db, user, projectId, 'organizer');
  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.projectId, projectId)).limit(1);
  if (project.status === 'ordered' || order) {
    throw new AppError(409, 'PROJECT_ORDERED', 'Проект уже заказан, его нельзя удалить');
  }
  const files = await db
    .select({ path: projectPhotos.storagePath })
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, projectId));
  await db.delete(projects).where(eq(projects.id, projectId));
  // Файлы удаляем после фиксации строк: сбой диска не должен вернуть удалённый проект.
  await Promise.allSettled(files.map((f) => storage.remove(f.path)));
  await audit(db, { userId: user.id, action: 'project.delete', objectType: 'project', objectId: projectId, result: 'ok' });
}
