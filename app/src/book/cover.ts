import type { Layout, Page } from '@picpac/shared';

/** Четыре цвета ткани обложки (кружки в макете); выбранный хранится в Cover.color. */
export const COVER_COLORS: readonly string[] = ['#F6EFE6', '#EDD5D5', '#CFE0DB', '#364C49'];

/** Текст на корешке возможен, только если книга достаточно толстая. */
export const SPINE_MIN_PAGES = 40;

export function spineAllowed(pageCount: number): boolean {
  return pageCount >= SPINE_MIN_PAGES;
}

/**
 * Страница, которую рисует обложка: выбранное фото — одно фото во всю страницу, заполняя кадр;
 * без выбора — первая страница книги (так было до редактора обложки).
 */
export function coverPage(layout: Layout): Page | null {
  const photoId = layout.cover?.photoId;
  if (photoId) {
    return { template: 'spread-one', cells: [{ photoId, crop: { x: 0, y: 0, scale: 1, rotation: 0 }, fit: 'cover' }] };
  }
  return layout.pages[0] ?? null;
}

/** Название на обложке: своё, а если не задано — название проекта. */
export function coverTitle(layout: Layout, projectTitle: string): string {
  const own = layout.cover?.title.trim();
  return own ? own : projectTitle;
}
