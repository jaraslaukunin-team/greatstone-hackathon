import { and, eq, inArray, ne, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import { interactions, orders, profiles, projectPhotos, projects } from '../../db/schema.js';

// Удаляет данные пользователя одной транзакцией, файлы стираются после её фиксации.
// Заказы остаются как финансовая запись без имени и адреса (customer_id и project_id становятся NULL).
// Фото, которые пользователь добавил в чужой уже заказанный проект, остаются без автора:
// этот альбом в производстве, и их удаление сломало бы чужой оплаченный заказ.
export async function deleteMyData(app: FastifyInstance, user: AuthUser): Promise<void> {
  const db = app.db;

  const files = await db
    .select({ path: projectPhotos.storagePath })
    .from(projectPhotos)
    .innerJoin(projects, eq(projects.id, projectPhotos.projectId))
    .where(or(eq(projects.ownerId, user.id), and(eq(projectPhotos.uploadedBy, user.id), eq(projects.status, 'draft'))));

  await db.transaction(async (tx) => {
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
  });

  // Сбой диска не должен возвращать удалённого пользователя: файлы чистим best effort.
  const results = await Promise.allSettled([...new Set(files.map((f) => f.path))].map((p) => app.storage.remove(p)));
  for (const r of results) if (r.status === 'rejected') app.log.error(r.reason, 'не удалось удалить файл при удалении данных');

  await audit(db, { userId: user.id, action: 'data.delete', objectType: 'profile', objectId: user.id, result: 'ok' });
}
