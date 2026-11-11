import { autoLayout, type Layout } from '@picpac/shared';

export type PhotoMeta = {
  id: string;
  width: number;
  height: number;
  takenAt: string | null;
};

/** Автомакет из общего пакета: клиент и сервер раскладывают фото одинаково. */
export function autoLayoutLocal(
  photos: PhotoMeta[],
  variant: { pagesMin: number; pagesMax: number },
): Layout {
  return autoLayout(photos, variant);
}

export function unplacedPhotos(layout: Layout, photos: PhotoMeta[]): PhotoMeta[] {
  const used = new Set(
    layout.pages.flatMap((p) => p.cells.map((c) => c.photoId).filter(Boolean) as string[]),
  );
  return photos.filter((p) => !used.has(p.id));
}
