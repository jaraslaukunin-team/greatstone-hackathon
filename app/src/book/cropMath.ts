import { fitRect, type Cell, type FitMode, type Size } from '@picpac/shared';

export const MIN_SCALE = 1;
export const MAX_SCALE = 4;

/**
 * Ограничивает кадр ячейки: масштаб 1..4, сдвиг (доли размера ячейки) не выводит фото за её границы.
 * В режиме «целиком» фото вписано с полями и двигать его нечем — сдвиг обнуляется.
 */
export function clampCrop(photo: Size, cell: Size, fit: FitMode, crop: Cell['crop']): Cell['crop'] {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, crop.scale));
  if (fit === 'contain') return { ...crop, scale, x: 0, y: 0 };
  const base = fitRect(photo, cell, 'cover');
  const maxX = Math.max(0, (base.width * scale - cell.width) / 2 / cell.width);
  const maxY = Math.max(0, (base.height * scale - cell.height) / 2 / cell.height);
  return {
    ...crop,
    scale,
    x: Math.min(maxX, Math.max(-maxX, crop.x)) + 0,
    y: Math.min(maxY, Math.max(-maxY, crop.y)) + 0,
  };
}
