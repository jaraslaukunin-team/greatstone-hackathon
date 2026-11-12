type Project = { id: string; isShared: boolean; ownerId: string };

/**
 * Куда вести после «Готово» на экране загрузки фото.
 * Обычная книга — в редактор. Общий альбом: организатор возвращается к сбору фото, участнику конструктор не нужен — он идёт на главную.
 * Пока проект не загрузился, возвращается null и экран использует переход по умолчанию.
 */
export function doneRoute(project: Project | null, userId: string | null | undefined): string | null {
  if (!project) return null;
  if (!project.isShared) return `/project/${project.id}/overview`;
  return project.ownerId === userId ? `/album/${project.id}` : '/(tabs)';
}
