import type { CropRect, Rotation } from './editState';

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };
export const MAX_EXPORT_SIDE = 4096;

/**
 * Размер готового фото: размер рамки обрезки в пикселях, с учётом поворота на 90°/270°.
 * Длинная сторона не больше maxSide, маленькое фото не растягивается.
 */
export function exportSize(
  srcW: number,
  srcH: number,
  crop: CropRect,
  rotation: Rotation,
  maxSide: number = MAX_EXPORT_SIDE,
): { width: number; height: number } {
  let w = srcW * crop.w;
  let h = srcH * crop.h;
  if (rotation === 90 || rotation === 270) [w, h] = [h, w];
  const longest = Math.max(w, h);
  const scale = longest > maxSide ? maxSide / longest : 1;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Рамка обрезки после поворота снимка на 90° по часовой стрелке (рамка остаётся на том же месте фото). */
export function rotateCropQuarter(crop: CropRect): CropRect {
  return { x: 1 - (crop.y + crop.h), y: crop.x, w: crop.h, h: crop.w };
}

/** Точка на экране (px) → доли кадра 0..1; за краем прижимается к границе. */
export function toFrameFractions(px: number, py: number, frameW: number, frameH: number): [number, number] {
  const fx = frameW > 0 ? px / frameW : 0;
  const fy = frameH > 0 ? py / frameH : 0;
  return [Math.min(1, Math.max(0, fx)), Math.min(1, Math.max(0, fy))];
}
