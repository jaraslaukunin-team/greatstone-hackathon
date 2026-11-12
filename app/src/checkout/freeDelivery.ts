import { formatByn } from '@picpac/shared';
import type { Kopecks } from '@picpac/shared';

/**
 * Сколько копеек не хватает до бесплатной доставки.
 * Возвращает 0 если доставка уже бесплатна или порог не задан.
 */
export function leftToFree(totalKop: Kopecks, freeFromKop: Kopecks | null): Kopecks {
  if (freeFromKop === null) return 0 as Kopecks;
  return Math.max(0, freeFromKop - totalKop) as Kopecks;
}

/** Строка-подсказка «Ещё X — и доставка бесплатно». */
export function freeDeliveryHint(totalKop: Kopecks, freeFromKop: Kopecks | null): string | null {
  const left = leftToFree(totalKop, freeFromKop);
  if (left === 0) return null;
  return `Ещё ${formatByn(left)} — и доставка бесплатно`;
}
