/** Разворот: индексы левой и правой страницы; null — страницы нет (у обложки слева пусто). */
export type Spread = [left: number | null, right: number | null];

/** Обложка лежит справа, дальше страницы парами; последняя может остаться без пары. */
export function spreadsOf(pageCount: number): Spread[] {
  if (pageCount <= 0) return [[null, null]];
  const spreads: Spread[] = [[null, 0]];
  for (let i = 1; i < pageCount; i += 2) spreads.push([i, i + 1 < pageCount ? i + 1 : null]);
  return spreads;
}

/** Следующий разворот в направлении dir; на краях книги остаётся на месте. */
export function nextIndex(index: number, total: number, dir: 1 | -1): number {
  if (total <= 0) return 0;
  return Math.min(total - 1, Math.max(0, index + dir));
}
