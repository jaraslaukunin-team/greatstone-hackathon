import type { AlbumProgress } from './useAlbumProgress';

export type MemberRow = {
  name: string;
  photos: number;
  done: boolean;
  /** Заполнено пожелание / указана ссылка на видео (для личного разворота). */
  hasWish: boolean;
  hasVideo: boolean;
};

/**
 * Build a display list of album members.
 * - First member is treated as the organizer and labelled «Организатор».
 * - Remaining members use childName when set, otherwise «Участник N» (1-indexed
 *   from the first non-organizer position).
 * - `done` is true when the member has uploaded at least one photo.
 */
export function memberRows(progress: AlbumProgress | null): MemberRow[] {
  if (!progress || progress.members.length === 0) return [];

  return progress.members.map((m, i) => {
    let name: string;
    if (i === 0) {
      name = 'Организатор';
    } else {
      name = m.childName?.trim() || `Участник ${i}`;
    }
    return {
      name,
      photos: m.photosCount,
      done: m.photosCount > 0,
      hasWish: Boolean(m.wish?.trim()),
      hasVideo: Boolean(m.videoUrl?.trim()),
    };
  });
}
