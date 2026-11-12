import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Layout, ProjectDTO } from '@picpac/shared';
import { audit } from '../../audit.js';
import { hashPassword } from '../../auth/password.js';
import type { AuthUser } from '../../auth/plugin.js';
import type { Db } from '../../db/client.js';
import { orders, projectMembers, projectPhotos, projects } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import type { Storage } from '../../storage/storage.js';
import { storageKey } from '../photos/service.js';
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
  hasPassword: p.joinPasswordHash !== null,
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
  input: { variantId: string; title: string; isShared?: boolean; expectedMembers?: number; joinPassword?: string },
): Promise<ProjectDTO> {
  await loadVariant(db, input.variantId);
  if (input.isShared && input.joinPassword === undefined) {
    throw new AppError(400, 'PASSWORD_REQUIRED', 'Для выпускного альбома нужен пароль: по ссылке без него вступить нельзя');
  }
  if (input.joinPassword !== undefined && !input.isShared) {
    throw new AppError(400, 'PASSWORD_NOT_ALLOWED', 'Пароль можно задать только общему выпускному альбому');
  }
  const [row] = await db
    .insert(projects)
    .values({
      ownerId: user.id,
      variantId: input.variantId,
      title: input.title,
      isShared: input.isShared ?? false,
      expectedMembers: input.expectedMembers ?? null,
      joinPasswordHash: input.joinPassword === undefined ? null : await hashPassword(input.joinPassword),
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

// Пароль входа в общий альбом обязателен: его меняет только организатор, снять его нельзя.
export async function setJoinPassword(db: Db, user: AuthUser, projectId: string, password: string): Promise<void> {
  const project = await assertProjectAccess(db, user, projectId, 'organizer');
  if (!project.isShared) throw new AppError(409, 'PROJECT_NOT_SHARED', 'Пароль есть только у общего выпускного альбома');
  if (project.status === 'ordered') throw new AppError(409, 'PROJECT_ORDERED', 'Альбом уже заказан');
  await db
    .update(projects)
    .set({ joinPasswordHash: await hashPassword(password), updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  await audit(db, {
    userId: user.id,
    action: 'album.password_changed',
    objectType: 'project',
    objectId: projectId,
    result: 'ok',
  });
}

export async function renameProject(db: Db, user: AuthUser, projectId: string, title: string): Promise<ProjectDTO> {
  const project = await assertProjectAccess(db, user, projectId, 'organizer');
  const [updated] = await db
    .update(projects)
    .set({ title, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();
  await audit(db, { userId: user.id, action: 'project.rename', objectType: 'project', objectId: projectId, result: 'ok' });
  return toProjectDTO(updated ?? { ...project, title, updatedAt: new Date() });
}

/** Копия макета на новые фото: тема, обложка, фон и подписи страниц сохраняются, id фото переназначаются. */
function remapLayout(layout: Layout, idMap: Map<string, string>): Layout {
  const remap = (id: string | null): string | null => (id != null && idMap.has(id) ? idMap.get(id)! : id);
  const { pages, cover, seen, ...rest } = layout;
  return {
    ...rest,
    pages: pages.map((page) => ({
      ...page,
      cells: page.cells.map((cell) => ({ ...cell, photoId: remap(cell.photoId) })),
    })),
    ...(cover ? { cover: { ...cover, photoId: remap(cover.photoId) } } : {}),
    ...(seen ? { seen: seen.map((id) => remap(id) ?? id) } : {}),
  };
}

export async function duplicateProject(app: FastifyInstance, user: AuthUser, projectId: string): Promise<ProjectDTO> {
  const db = app.db;
  const storage = app.storage;

  // Владелец — всегда. Участник общего альбома — только когда альбом уже заказан («своя копия»).
  const src = await assertProjectAccess(db, user, projectId, 'read');
  const isOwner = src.ownerId === user.id;
  const memberMayCopy = src.isShared && src.status === 'ordered';
  if (!isOwner && !memberMayCopy) {
    await audit(db, {
      userId: user.id,
      action: 'access.denied',
      objectType: 'project',
      objectId: projectId,
      result: 'denied',
    });
    throw new AppError(404, 'NOT_FOUND', 'Проект не найден');
  }

  // Загрузить исходные фото.
  const srcPhotos = await db
    .select()
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, projectId))
    .orderBy(asc(projectPhotos.position), asc(projectPhotos.createdAt));

  // Скопировать файлы в памяти (до создания БД-записей), чтобы можно было откатиться без сирот.
  const newProjectId = randomUUID();
  // Буферы фото не храним: копируем по одному и держим только ключи, иначе большая книга целиком оказывается в памяти API.
  const copies: Array<{ newId: string; key: string; src: typeof srcPhotos[number] }> = [];
  try {
    for (const photo of srcPhotos) {
      let data: Buffer;
      try {
        data = await storage.get(photo.storagePath);
      } catch {
        throw new AppError(422, 'PHOTO_FILE_MISSING', `Файл фото ${photo.id} не найден в хранилище`);
      }
      const newId = randomUUID();
      const key = storageKey(newProjectId, newId);
      await storage.put(key, data);
      copies.push({ newId, key, src: photo });
    }
  } catch (e) {
    // Откат: удалить все уже скопированные файлы.
    await Promise.allSettled(copies.map((c) => storage.remove(c.key)));
    throw e;
  }

  // Карта старый ID → новый ID для ремаппинга макета.
  const idMap = new Map(copies.map((c) => [c.src.id, c.newId]));

  const sourceLayout = (src.layout as Layout | null) ?? { pages: [] };
  const newLayout = remapLayout(sourceLayout, idMap);
  const newTitle = `${src.title} — копия`;

  let newProject: typeof projects.$inferSelect;
  try {
    // Вставить новый проект.
    const [inserted] = await db
      .insert(projects)
      .values({
        id: newProjectId,
        ownerId: user.id,
        variantId: src.variantId,
        title: newTitle,
        isShared: false,
        expectedMembers: null,
        joinPasswordHash: null,
        status: 'draft',
        layout: newLayout,
      })
      .returning();
    newProject = inserted!;

    // Вставить копии фото.
    if (copies.length > 0) {
      await db.insert(projectPhotos).values(
        copies.map((c) => ({
          id: c.newId,
          projectId: newProjectId,
          uploadedBy: user.id,
          storagePath: c.key,
          position: c.src.position,
          width: c.src.width,
          height: c.src.height,
          takenAt: c.src.takenAt,
          source: c.src.source,
        })),
      );
    }
  } catch (e) {
    // Откат хранилища: новый проект мог не создаться или ошибка при вставке фото.
    await Promise.allSettled(copies.map((c) => storage.remove(c.key)));
    // Попытаться удалить проект из БД, если он всё-таки вставился.
    await db.delete(projects).where(eq(projects.id, newProjectId)).catch(() => undefined);
    throw e;
  }

  await audit(db, { userId: user.id, action: 'project.duplicate', objectType: 'project', objectId: newProjectId, result: 'ok' });
  return toProjectDTO(newProject);
}
