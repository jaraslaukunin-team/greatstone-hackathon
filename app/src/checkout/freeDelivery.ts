import { formatByn } from '@picpac/shared';
import type { Kopecks } from '@picpac/shared';

/**
 * Сколько копеек не хватает до бесплатной доставки.
 * `goodsKop` — сумма товара после скидки (без доставки).
 * Возвращает 0 если доставка уже бесплатна или порог не задан.
 */
export function leftToFree(goodsKop: Kopecks, freeFromKop: Kopecks | null): Kopecks {
  if (freeFromKop === null) return 0 as Kopecks;
  return Math.max(0, freeFromKop - goodsKop) as Kopecks;
}

/** Строка-подсказка «Ещё X — и доставка бесплатно» (порог от суммы товара без доставки). */
export function freeDeliveryHint(goodsKop: Kopecks, freeFromKop: Kopecks | null): string | null {
  const left = leftToFree(goodsKop, freeFromKop);
  if (left === 0) return null;
  return `Ещё ${formatByn(left)} — и доставка бесплатно`;
}
