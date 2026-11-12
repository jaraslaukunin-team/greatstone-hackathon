import { checkQuality, type Layout, type PhotoMeta } from '@picpac/shared';
import { spreadsOf } from './flip';

export type SpreadIssue = 'empty' | 'blurry';

/**
 * Проблемы по разворотам в порядке разворотов (обложка — нулевой): «пусто» — пустая ячейка или фото, которого
 * нет в проекте (такой заказ не оформить), «нерезко» — предупреждение о качестве. Считает тот же checkQuality, что и проверка перед заказом.
 */
export function spreadIssues(layout: Layout, photos: Record<string, PhotoMeta>, variant: { pageWidthCm: number }): SpreadIssue[][] {
  const spreads = spreadsOf(layout.pages.length);
  const spreadOfPage = new Map<number, number>();
  spreads.forEach(([left, right], index) => {
    if (left !== null) spreadOfPage.set(left, index);
    if (right !== null) spreadOfPage.set(right, index);
  });

  const result: Set<SpreadIssue>[] = spreads.map(() => new Set());
  for (const issue of checkQuality(layout, photos, variant)) {
    const at = spreadOfPage.get(issue.pageIndex);
    if (at === undefined) continue;
    result[at]!.add(issue.severity === 'blocker' ? 'empty' : 'blurry');
  }
  // «Пусто» важнее, поэтому идёт первым.
  return result.map((set) => (['empty', 'blurry'] as const).filter((kind) => set.has(kind)));
}
