import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { autoLayout, personalizeLayout, type Layout, type ProjectDTO } from '@picpac/shared';
import { audit } from '../../audit.js';
import { hashPassword } from '../../auth/password.js';
import type { AuthUser } from '../../auth/plugin.js';
import type { Db } from '../../db/client.js';
import type { PhotoDTO } from '@picpac/shared';
import { orders, products, projectMembers, projectPhotos, projects } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import type { Storage } from '../../storage/storage.js';
import { storageKey, toPhotoDTO } from '../photos/service.js';
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
  isPool: p.isPool,
  sourceProjectId: p.sourceProjectId,
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
  input: {
    variantId: string;
    title: string;
    isShared?: boolean;
    isPool?: boolean;
    expectedMembers?: number;
    joinPassword?: string;
  },
): Promise<ProjectDTO> {
  const variant = await loadVariant(db, input.variantId);
  const isPool = input.isPool === true;
  const isShared = input.isShared ?? false;

  if (isPool) {
    if (!isShared) {
      throw new AppError(400, 'POOL_REQUIRES_SHARED', 'Общий альбом должен быть совместным (isShared)');
    }
    const [product] = await db.select().from(products).where(eq(products.id, variant.productId));
    if (!product || product.kind !== 'photobook') {
      throw new AppError(400, 'POOL_FORMAT', 'Общий альбом создаётся только для фотокниги');
    }
  }
  // Пароль обязателен для любого совместного альбома (выпускной и общий пул).
  if (isShared && input.joinPassword === undefined) {
    throw new AppError(400, 'PASSWORD_REQUIRED', 'Для общего альбома нужен пароль: по ссылке без него вступить нельзя');
  }
  if (input.joinPassword !== undefined && !isShared) {
    throw new AppError(400, 'PASSWORD_NOT_ALLOWED', 'Пароль можно задать только общему выпускному альбому');
  }
  const [row] = await db
    .insert(projects)
    .values({
      ownerId: user.id,
      variantId: input.variantId,
      title: input.title,
      isShared,
      isPool,
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
  await assertProjectAccess(db, user, projectId, 'organizer');
  const files = await db.transaction(async (tx) => {
    const [project] = await tx.select({ status: projects.status }).from(projects)
      .where(eq(projects.id, projectId)).for('update');
    if (!project) throw notFound();
    const [order] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.projectId, projectId)).limit(1);
    if (project.status === 'ordered' || order) {
      throw new AppError(409, 'PROJECT_ORDERED', 'Проект уже заказан, его нельзя удалить');
    }
    const files = await tx
      .select({ path: projectPhotos.storagePath })
      .from(projectPhotos)
      .where(eq(projectPhotos.projectId, projectId));
    await tx.delete(projects).where(eq(projects.id, projectId));
    return files;
  });
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

export async function duplicateProject(
  app: FastifyInstance,
  user: AuthUser,
  projectId: string,
  opts: { personal?: boolean } = {},
): Promise<ProjectDTO> {
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
  let newLayout = remapLayout(sourceLayout, idMap);
  if (opts.personal) {
    // Именная копия: имя берётся из записи участника, личные страницы идентифицируются его userId.
    const [member] = await db
      .select({ childName: projectMembers.childName })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)));
    newLayout = personalizeLayout(newLayout, user.id, member?.childName ?? null);
  }
  const newTitle = `${src.title} — копия`;

  let newProject: typeof projects.$inferSelect;
  try {
    newProject = await db.transaction(async (tx) => {
      // Вставить новый проект.
      const [inserted] = await tx
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

      // Вставить копии фото.
      if (copies.length > 0) {
        await tx.insert(projectPhotos).values(
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
      return inserted!;
    });
  } catch (e) {
    // Откат хранилища: новый проект мог не создаться или ошибка при вставке фото.
    await Promise.allSettled(copies.map((c) => storage.remove(c.key)));
    throw e;
  }

  await audit(db, { userId: user.id, action: 'project.duplicate', objectType: 'project', objectId: newProjectId, result: 'ok' });
  return toProjectDTO(newProject);
}

/** Личная книга участника пула: копия всех фото с sourcePhotoId. Повторный вызов возвращает ту же книгу. */
export async function forkPoolProject(app: FastifyInstance, user: AuthUser, poolId: string): Promise<ProjectDTO> {
  const db = app.db;
  const storage = app.storage;
  const pool = await assertProjectAccess(db, user, poolId, 'read');
  if (!pool.isPool) {
    throw new AppError(409, 'NOT_A_POOL', 'Свою книгу можно собрать только из общего альбома');
  }

  const [existing] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, user.id), eq(projects.sourceProjectId, pool.id)));
  if (existing) return toProjectDTO(existing);

  const srcPhotos = await db
    .select()
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, pool.id))
    .orderBy(asc(projectPhotos.position), asc(projectPhotos.createdAt));

  const newProjectId = randomUUID();
  const copies: Array<{ newId: string; key: string; src: (typeof srcPhotos)[number] }> = [];
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
    await Promise.allSettled(copies.map((c) => storage.remove(c.key)));
    throw e;
  }

  let newProject: typeof projects.$inferSelect;
  try {
    const [inserted] = await db
      .insert(projects)
      .values({
        id: newProjectId,
        ownerId: user.id,
        variantId: pool.variantId,
        title: pool.title,
        isShared: false,
        isPool: false,
        sourceProjectId: pool.id,
        expectedMembers: null,
        joinPasswordHash: null,
        status: 'draft',
        layout: { pages: [] },
      })
      .returning();
    newProject = inserted!;
    if (copies.length > 0) {
      await db.insert(projectPhotos).values(
        copies.map((c) => ({
          id: c.newId,
          projectId: newProjectId,
          uploadedBy: c.src.uploadedBy,
          storagePath: c.key,
          position: c.src.position,
          width: c.src.width,
          height: c.src.height,
          takenAt: c.src.takenAt,
          source: c.src.source,
          sourcePhotoId: c.src.id,
        })),
      );
    }
  } catch (e) {
    await Promise.allSettled(copies.map((c) => storage.remove(c.key)));
    await db.delete(projects).where(eq(projects.id, newProjectId)).catch(() => undefined);
    throw e;
  }

  await audit(db, { userId: user.id, action: 'project.fork', objectType: 'project', objectId: newProjectId, result: 'ok' });
  return toProjectDTO(newProject);
}

/**
 * Личный разворот ученика выпускного альбома: копия своих фото + макет на 2 страницы.
 * Повторный вызов возвращает ту же книгу (правки макета сохраняются).
 */
export async function createMemberSpread(
  app: FastifyInstance,
  user: AuthUser,
  albumId: string,
): Promise<ProjectDTO> {
  const db = app.db;
  const storage = app.storage;
  const album = await assertProjectAccess(db, user, albumId, 'read');
  if (!album.isShared || album.isPool) {
    throw new AppError(409, 'NOT_GRADUATION', 'Личный разворот доступен только в выпускном альбоме');
  }
  if (album.ownerId === user.id) {
    throw new AppError(409, 'OWNER_HAS_ALBUM', 'Организатор собирает общий альбом, а не личный разворот');
  }

  const [existing] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.ownerId, user.id), eq(projects.sourceProjectId, album.id)));
  if (existing) return toProjectDTO(existing);

  const ownPhotos = await db
    .select()
    .from(projectPhotos)
    .where(and(eq(projectPhotos.projectId, album.id), eq(projectPhotos.uploadedBy, user.id)))
    .orderBy(asc(projectPhotos.position), asc(projectPhotos.createdAt));
  if (ownPhotos.length < 2) {
    throw new AppError(422, 'PHOTOS_REQUIRED', 'Загрузите от 2 до 8 фото для своего разворота');
  }

  const newProjectId = randomUUID();
  const copies: Array<{ newId: string; key: string; src: (typeof ownPhotos)[number] }> = [];
  try {
    for (const photo of ownPhotos.slice(0, 8)) {
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
    await Promise.allSettled(copies.map((c) => storage.remove(c.key)));
    throw e;
  }

  const metas = copies.map((c) => ({
    id: c.newId,
    width: c.src.width,
    height: c.src.height,
    takenAt: c.src.takenAt ? c.src.takenAt.toISOString() : null,
  }));
  // 3 страницы → развороты [—,0] и [1,2]: place открывает spread=1 как полный разворот.
  const layout = autoLayout(metas, { pagesMin: 3, pagesMax: 3 });

  let newProject: typeof projects.$inferSelect;
  try {
    const [inserted] = await db
      .insert(projects)
      .values({
        id: newProjectId,
        ownerId: user.id,
        variantId: album.variantId,
        title: album.title,
        isShared: false,
        isPool: false,
        sourceProjectId: album.id,
        expectedMembers: null,
        joinPasswordHash: null,
        status: 'draft',
        layout,
      })
      .returning();
    newProject = inserted!;
    await db.insert(projectPhotos).values(
      copies.map((c, i) => ({
        id: c.newId,
        projectId: newProjectId,
        uploadedBy: user.id,
        storagePath: c.key,
        position: i,
        width: c.src.width,
        height: c.src.height,
        takenAt: c.src.takenAt,
        source: c.src.source,
        sourcePhotoId: c.src.id,
      })),
    );
  } catch (e) {
    await Promise.allSettled(copies.map((c) => storage.remove(c.key)));
    await db.delete(projects).where(eq(projects.id, newProjectId)).catch(() => undefined);
    throw e;
  }

  await audit(db, {
    userId: user.id,
    action: 'project.member_spread',
    objectType: 'project',
    objectId: newProjectId,
    result: 'ok',
  });
  return toProjectDTO(newProject);
}

/** Дописать в личную книгу фото пула, которых ещё нет (по sourcePhotoId). Макет не трогает. */
export async function syncPoolProject(
  app: FastifyInstance,
  user: AuthUser,
  bookId: string,
): Promise<{ added: PhotoDTO[] }> {
  const db = app.db;
  const storage = app.storage;
  const book = await assertProjectAccess(db, user, bookId, 'organizer');
  if (!book.sourceProjectId) {
    throw new AppError(409, 'NOT_A_FORK', 'Подтянуть фото можно только в книгу из общего альбома');
  }
  if (book.status === 'ordered') {
    throw new AppError(409, 'PROJECT_ORDERED', 'Проект уже заказан и больше не меняется');
  }
  const pool = await assertProjectAccess(db, user, book.sourceProjectId, 'read');
  if (!pool.isPool) {
    throw new AppError(409, 'NOT_A_POOL', 'Источник книги больше не является общим альбомом');
  }

  const existing = await db
    .select({ sourcePhotoId: projectPhotos.sourcePhotoId })
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, book.id));
  const have = new Set(existing.map((r) => r.sourcePhotoId).filter((id): id is string => id != null));

  const poolPhotos = await db
    .select()
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, pool.id))
    .orderBy(asc(projectPhotos.position), asc(projectPhotos.createdAt));
  const missing = poolPhotos.filter((p) => !have.has(p.id));
  if (missing.length === 0) return { added: [] };

  const [{ next }] = (await db
    .select({ next: sql<number>`coalesce(max(${projectPhotos.position}) + 1, 0)::int` })
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, book.id))) as [{ next: number }];

  const added: PhotoDTO[] = [];
  const written: string[] = [];
  try {
    let position = next;
    for (const photo of missing) {
      let data: Buffer;
      try {
        data = await storage.get(photo.storagePath);
      } catch {
        throw new AppError(422, 'PHOTO_FILE_MISSING', `Файл фото ${photo.id} не найден в хранилище`);
      }
      const newId = randomUUID();
      const key = storageKey(book.id, newId);
      await storage.put(key, data);
      written.push(key);
      const [row] = await db
        .insert(projectPhotos)
        .values({
          id: newId,
          projectId: book.id,
          uploadedBy: photo.uploadedBy,
          storagePath: key,
          position,
          width: photo.width,
          height: photo.height,
          takenAt: photo.takenAt,
          source: photo.source,
          sourcePhotoId: photo.id,
        })
        .returning();
      position += 1;
      added.push(toPhotoDTO(app, row!));
    }
  } catch (e) {
    await Promise.allSettled(written.map((k) => storage.remove(k)));
    throw e;
  }

  await audit(db, { userId: user.id, action: 'project.sync', objectType: 'project', objectId: book.id, result: 'ok' });
  return { added };
}
