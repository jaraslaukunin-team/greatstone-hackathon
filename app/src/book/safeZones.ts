import type { Rect } from '@picpac/shared';

/**
 * Безопасная область страницы: то, что внутри, не обрежут при печати. Обрез — 3 мм по краям
 * (допуск типографии 2–3 мм), пересчитывается в пиксели по реальной ширине страницы.
 */
export function bleedRect(pageW: number, pageH: number, pageWidthCm: number, bleedMm = 3): Rect {
  if (pageWidthCm <= 0) return { x: 0, y: 0, width: pageW, height: pageH };
  const inset = (bleedMm * pageW) / (10 * pageWidthCm);
  return { x: inset, y: inset, width: Math.max(0, pageW - 2 * inset), height: Math.max(0, pageH - 2 * inset) };
}

/** Ширина полосы у корешка (в пикселях), куда лучше не ставить лица и текст: книга там уходит в сгиб. */
export function foldBandWidth(pageW: number, pageWidthCm: number, mm = 10): number {
  if (pageWidthCm <= 0) return 0;
  return (mm * pageW) / (10 * pageWidthCm);
}
