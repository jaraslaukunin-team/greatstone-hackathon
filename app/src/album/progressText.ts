export type ProgressLike = { expected: number | null; members: Array<{ photosCount: number }> } | null;

/** Сколько человек уже добавили фото (участник без фото не считается). */
export function addedCount(members: Array<{ photosCount: number }>): number {
  return members.filter((m) => m.photosCount > 0).length;
}

export function progressText(progress: ProgressLike): string {
  if (!progress) return '…';
  return `${addedCount(progress.members)} из ${progress.expected ?? '?'} добавили фото`;
}
