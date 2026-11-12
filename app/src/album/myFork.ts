import type { ProjectDTO } from '@picpac/shared';

/** Книга текущего пользователя, собранная из пула (sourceProjectId = poolId). */
export function myFork(
  projects: ProjectDTO[],
  poolId: string,
  userId: string,
): ProjectDTO | null {
  return projects.find((p) => p.sourceProjectId === poolId && p.ownerId === userId) ?? null;
}
