import { and, count, eq, exists, inArray, ne, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { DataSummaryDTO } from '@picpac/shared';
import { AppError } from '../../errors.js';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import { consents, interactions, orders, profiles, projectPhotos, projects } from '../../db/schema.js';

// Удаляет данные пользователя одной транзакцией, файлы стираются после её фиксации.
// Заказы остаются как финансовая запись без имени и адреса (customer_id и project_id становятся NULL).
// Фото, которые пользователь добавил в чужой уже заказанный проект, остаются без автора:
// этот альбом в производстве, и их удаление сломало бы чужой оплаченный заказ.
export async function deleteMyData(app: FastifyInstance, user: AuthUser): Promise<void> {
  const db = app.db;

  const files = await db.transaction(async (tx) => {
    await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, user.id)).for('no key update');
    const affectedProjects = or(
      eq(projects.ownerId, user.id),
      and(eq(projects.status, 'draft'), exists(
        tx.select({ id: projectPhotos.id }).from(projectPhotos)
          .where(and(eq(projectPhotos.projectId, projects.id), eq(projectPhotos.uploadedBy, user.id))),
      )),
    );
    await tx.select({ id: projects.id }).from(projects).where(affectedProjects).orderBy(projects.id).for('update');
    const [favorite] = await tx
      .select({ id: orders.id })
      .from(orders)
      .leftJoin(projects, eq(projects.id, orders.projectId))
      .where(and(eq(orders.favorite, true), or(eq(orders.customerId, user.id), affectedProjects)))
      .limit(1);
    if (favorite) {
      throw new AppError(409, 'FAVORITE_ORDER_RETAINED', 'Данные связаны с избранным заказом. Для удаления нужно сначала убрать заказ из избранного');
    }
    const files = await tx
      .select({ path: projectPhotos.storagePath })
      .from(projectPhotos)
      .innerJoin(projects, eq(projects.id, projectPhotos.projectId))
      .where(or(eq(projects.ownerId, user.id), and(eq(projectPhotos.uploadedBy, user.id), eq(projects.status, 'draft'))));
    await tx.update(orders).set({ recipientName: null, address: null }).where(eq(orders.customerId, user.id));
    const othersDrafts = tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.status, 'draft'), ne(projects.ownerId, user.id)));
    await tx
      .delete(projectPhotos)
      .where(and(eq(projectPhotos.uploadedBy, user.id), inArray(projectPhotos.projectId, othersDrafts)));
    await tx.delete(interactions).where(eq(interactions.customerId, user.id));
    await tx.delete(projects).where(eq(projects.ownerId, user.id));
    // Остальное уходит каскадом: согласия, AI-задачи, членство в альбомах.
    await tx.delete(profiles).where(eq(profiles.id, user.id));
    return files;
  });

  // Сбой диска не должен возвращать удалённого пользователя: файлы чистим best effort.
  const results = await Promise.allSettled([...new Set(files.map((f) => f.path))].map((p) => app.storage.remove(p)));
  for (const r of results) if (r.status === 'rejected') app.log.error(r.reason, 'не удалось удалить файл при удалении данных');

  await audit(db, { userId: user.id, action: 'data.delete', objectType: 'profile', objectId: user.id, result: 'ok' });
}

/** Сводка для экрана «Мои данные и безопасность»: только то, что принадлежит самому пользователю. */
export async function getDataSummary(app: FastifyInstance, user: AuthUser): Promise<DataSummaryDTO> {
  const db = app.db;
  const [[p], [ph], [o], [c]] = await Promise.all([
    db.select({ n: count() }).from(projects).where(eq(projects.ownerId, user.id)),
    db.select({ n: count() }).from(projectPhotos).where(eq(projectPhotos.uploadedBy, user.id)),
    db.select({ n: count() }).from(orders).where(eq(orders.customerId, user.id)),
    db
      .select({ at: consents.acceptedAt })
      .from(consents)
      .where(and(eq(consents.userId, user.id), eq(consents.kind, 'ai_processing'))),
  ]);
  return { projects: p!.n, photos: ph!.n, orders: o!.n, aiConsentAt: c ? c.at.toISOString() : null };
}
