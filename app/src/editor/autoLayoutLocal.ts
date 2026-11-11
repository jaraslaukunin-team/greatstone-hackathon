import type { Layout, Page } from '@picpac/shared';

export type PhotoMeta = {
  id: string;
  width: number;
  height: number;
  takenAt: string | null;
};

const emptyCrop = { x: 0, y: 0, scale: 1, rotation: 0 as const };

function cell(photoId: string | null) {
  return { photoId, crop: { ...emptyCrop } };
}

/** Local fallback until S2 lands in @picpac/shared */
export function autoLayoutLocal(
  photos: PhotoMeta[],
  variant: { pagesMin: number; pagesMax: number },
): Layout {
  const sorted = [...photos].sort((a, b) => {
    if (!a.takenAt && !b.takenAt) return 0;
    if (!a.takenAt) return 1;
    if (!b.takenAt) return -1;
    return a.takenAt.localeCompare(b.takenAt);
  });

  const pages: Page[] = [];
  let i = 0;
  while (i < sorted.length && pages.length < variant.pagesMax) {
    const photo = sorted[i]!;
    const portrait = photo.height >= photo.width;
    if (portrait || i === sorted.length - 1) {
      pages.push({ template: 'one', cells: [cell(photo.id)] });
      i += 1;
      continue;
    }
    const next = sorted[i + 1];
    if (next && next.width > next.height) {
      pages.push({ template: 'two', cells: [cell(photo.id), cell(next.id)] });
      i += 2;
      continue;
    }
    pages.push({ template: 'one', cells: [cell(photo.id)] });
    i += 1;
  }

  while (pages.length < variant.pagesMin) {
    pages.push({ template: 'one', cells: [cell(null)] });
  }

  return { pages };
}

export function unplacedPhotos(layout: Layout, photos: PhotoMeta[]): PhotoMeta[] {
  const used = new Set(
    layout.pages.flatMap((p) => p.cells.map((c) => c.photoId).filter(Boolean) as string[]),
  );
  return photos.filter((p) => !used.has(p.id));
}
