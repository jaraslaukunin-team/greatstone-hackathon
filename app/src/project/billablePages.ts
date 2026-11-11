import type { Layout } from '@picpac/shared';

/** Сколько «страниц» считает сервер: у печати фото это общее число отпечатков (с копиями), у книги число страниц. */
export function billablePages(layout: Layout): number {
  return Math.max(1, layout.pages.reduce((sum, p) => sum + (p.copies ?? 1), 0));
}
