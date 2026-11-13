import type { Layout, PhotoDTO } from '@picpac/shared';
import { spreadsOf } from '../book/flip';

export function storyTimeline(layout: Layout, photos: ReadonlyMap<string, PhotoDTO>) {
  const moments = new Map<string, { photo: PhotoDTO; day: string | null; spread: number }>();
  spreadsOf(layout.pages.length).forEach((pages, spread) => {
    for (const index of pages) {
      if (index === null) continue;
      for (const cell of layout.pages[index]?.cells ?? []) {
        if (!cell.photoId || cell.hidden || moments.has(cell.photoId)) continue;
        const photo = photos.get(cell.photoId);
        if (!photo) continue;
        const timestamp = Date.parse(photo.takenAt ?? '');
        const day = Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : null;
        moments.set(photo.id, { photo, day, spread });
      }
    }
  });
  return [...moments.values()].sort((a, b) => {
    const first = a.day ? Date.parse(a.photo.takenAt!) : Infinity;
    const second = b.day ? Date.parse(b.photo.takenAt!) : Infinity;
    return first - second;
  });
}
