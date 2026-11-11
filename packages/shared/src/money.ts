import type { Kopecks } from './types.js';

/** Форматирует целые копейки в строку вида `87,40 BYN`. */
export function formatByn(kop: Kopecks): string {
  if (!Number.isInteger(kop)) {
    throw new Error('Kopecks must be an integer');
  }
  const sign = kop < 0 ? '-' : '';
  const abs = Math.abs(kop);
  const rubles = Math.floor(abs / 100);
  const coins = String(abs % 100).padStart(2, '0');
  return `${sign}${rubles},${coins} BYN`;
}
