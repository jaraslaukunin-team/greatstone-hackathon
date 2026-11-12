type Project = { id: string; isShared: boolean; ownerId: string; isPool?: boolean };

/**
 * Куда вести после «Готово» на экране загрузки фото.
 * Обычная книга — в редактор. Выпускной: организатор — к сбору, участник — к пожеланию.
 * Общий пул: и организатор, и участник — на экран альбома.
 */
export function doneRoute(project: Project | null, userId: string | null | undefined): string | null {
  if (!project) return null;
  if (!project.isShared) return `/project/${project.id}/overview`;
  if (project.isPool) return `/album/${project.id}`;
  return project.ownerId === userId ? `/album/${project.id}` : `/album/me?projectId=${project.id}`;
}
