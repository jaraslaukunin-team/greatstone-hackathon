import type { Layout } from '@picpac/shared';
import { spreadsOf } from './flip';
import type { SpreadIssue } from './spreadIssues';

/**
 * Подпись разворота по физическим номерам страниц (номер = индекс страницы + 1).
 * spreadsOf кладёт первую страницу одну справа, поэтому разворот 0 — «1 · Начало», разворот k — «2k–2k+1»,
 * а последняя непарная страница книги подписана «N · Финал».
 */
export function spreadRange(index: number, pageCount: number): string {
  if (index <= 0) return '1 · Начало';
  const spread = spreadsOf(pageCount)[index];
  if (!spread) return '';
  const [left, right] = spread;
  if (left === null) return '1 · Начало';
  if (right === null) return `${left + 1} · Финал`;
  return `${left + 1}–${right + 1}`;
}

/** Сколько фото стоит на развороте. */
export function spreadPhotoCount(layout: Layout, index: number): number {
  const spread = spreadsOf(layout.pages.length)[index];
  if (!spread) return 0;
  return spread.reduce<number>((sum, p) => {
    if (p === null) return sum;
    return sum + (layout.pages[p]?.cells.filter((c) => c.photoId).length ?? 0);
  }, 0);
}

export type PageTile = { kind: 'cover' | 'spread'; spreadIndex: number; caption: string; issues: SpreadIssue[] };

/** Плитки сетки «Страницы»: обложка, затем по плитке на каждый разворот. */
export function pageTiles(layout: Layout, issues: SpreadIssue[][]): PageTile[] {
  const count = layout.pages.length;
  const tiles: PageTile[] = [{ kind: 'cover', spreadIndex: 0, caption: 'Обложка', issues: [] }];
  spreadsOf(count).forEach((_, index) => {
    tiles.push({ kind: 'spread', spreadIndex: index, caption: spreadRange(index, count), issues: issues[index] ?? [] });
  });
  return tiles;
}
