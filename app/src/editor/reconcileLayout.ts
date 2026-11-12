import type { Layout } from '@picpac/shared';
import { autoLayoutLocal, type PhotoMeta } from './autoLayoutLocal';

function placedIds(layout: Layout): Set<string> {
  return new Set(layout.pages.flatMap((p) => p.cells.map((c) => c.photoId).filter(Boolean) as string[]));
}

/** В макете есть работа человека: размещённые фото, обложка, фон или подписи. */
export function hasContent(layout: Layout): boolean {
  if (placedIds(layout).size > 0) return true;
  if (layout.cover && (layout.cover.photoId || layout.cover.title)) return true;
  return layout.pages.some((p) => p.bg || (p.texts && p.texts.length > 0));
}

/** Помечает фото учтёнными: добавляет их id к `seen`, не теряя прежние. */
export function markSeen(layout: Layout, ids: string[]): Layout {
  const seen = new Set(layout.seen ?? []);
  let changed = false;
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      changed = true;
    }
  }
  return changed ? { ...layout, seen: Array.from(seen) } : layout;
}

/**
 * Согласует макет с текущим списком фото, не затирая правки.
 * Пустой макет раскладывается заново. Макет с работой сохраняется целиком, а в конец добавляются
 * только действительно новые фото: фото, которое человек убрал со страницы, не возвращается.
 * Макеты без `seen` (сохранённые до этого поля) ничего не добавляют, а лишь запоминают текущие фото.
 */
export function reconcileLayout(
  previous: Layout,
  photos: PhotoMeta[],
  limits: { pagesMin: number; pagesMax: number },
): Layout {
  const ids = photos.map((p) => p.id);
  if (!hasContent(previous)) {
    const seen = new Set(previous.seen);
    if (previous.pages.length && ids.length && ids.every((id) => seen.has(id))) return previous;
    return { ...autoLayoutLocal(photos, limits), seen: ids };
  }
  if (!previous.seen) return markSeen(previous, ids);

  const seen = new Set(previous.seen);
  const placed = placedIds(previous);
  const fresh = photos.filter((p) => !seen.has(p.id) && !placed.has(p.id));
  const capacity = limits.pagesMax - previous.pages.length;
  if (fresh.length === 0 || capacity <= 0) {
    // Фото, уже стоящие на страницах, учтены в любом случае.
    return markSeen(previous, ids.filter((id) => placed.has(id)));
  }
  const extra = autoLayoutLocal(fresh, { pagesMin: 1, pagesMax: Math.max(1, capacity) });
  return markSeen({ ...previous, pages: [...previous.pages, ...extra.pages] }, ids);
}
