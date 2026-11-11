import type { Cell, Layout, Page } from './types';

export type PhotoMeta = { id: string; width: number; height: number; takenAt: string | null };

const emptyCell = (): Cell => ({ photoId: null, crop: { x: 0, y: 0, scale: 1, rotation: 0 } });
const cellFor = (photo: PhotoMeta): Cell => ({ photoId: photo.id, crop: { x: 0, y: 0, scale: 1, rotation: 0 } });
const isLandscape = (p: PhotoMeta) => p.width > p.height;

// Rule: photos go in takenAt order (undated last, stable); while photos remain and pages are left, a page takes
// 4 photos if 4+ photos remain and they exceed the remaining pages, 2 if two landscapes come in a row, else 1.
export function autoLayout(photos: PhotoMeta[], variant: { pagesMin: number; pagesMax: number }): Layout {
  const sorted = photos
    .map((photo, index) => ({ photo, index, time: photo.takenAt === null ? Infinity : Date.parse(photo.takenAt) }))
    .sort((a, b) => (a.time === b.time ? a.index - b.index : a.time - b.time))
    .map((x) => x.photo);

  const pages: Page[] = [];
  let i = 0;
  while (i < sorted.length && pages.length < variant.pagesMax) {
    const remaining = sorted.length - i;
    const pagesLeft = variant.pagesMax - pages.length;
    const current = sorted[i]!;
    if (remaining >= 4 && remaining > pagesLeft) {
      pages.push({ template: 'four', cells: sorted.slice(i, i + 4).map(cellFor) });
      i += 4;
    } else if (isLandscape(current) && i + 1 < sorted.length && isLandscape(sorted[i + 1]!)) {
      pages.push({ template: 'two', cells: [cellFor(current), cellFor(sorted[i + 1]!)] });
      i += 2;
    } else {
      pages.push({ template: 'one', cells: [cellFor(current)] });
      i += 1;
    }
  }
  while (pages.length < variant.pagesMin) pages.push({ template: 'one', cells: [emptyCell()] });
  return { pages };
}

export function unplacedPhotos(layout: Layout, photos: PhotoMeta[]): PhotoMeta[] {
  const placed = new Set(layout.pages.flatMap((p) => p.cells.map((c) => c.photoId)));
  return photos.filter((p) => !placed.has(p.id));
}
