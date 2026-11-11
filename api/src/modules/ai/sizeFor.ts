import { aspectValue, type AspectRatio } from '@picpac/shared';

// Размеры, которые принимают модели правки изображений (/images/edits).
const SIZES = [
  { size: '1024x1024', ratio: 1 },
  { size: '1536x1024', ratio: 1536 / 1024 },
  { size: '1024x1536', ratio: 1024 / 1536 },
] as const;
export type ImageSize = (typeof SIZES)[number]['size'];

/** Ближайший к нужной пропорции размер; сравнение по логарифму, чтобы 2:1 и 1:2 были равноудалены от 1:1. */
export function sizeFor(aspect: AspectRatio, source: { width: number; height: number }): ImageSize {
  const want = Math.log(aspectValue(aspect, source));
  let best: (typeof SIZES)[number] = SIZES[0];
  for (const s of SIZES) if (Math.abs(Math.log(s.ratio) - want) < Math.abs(Math.log(best.ratio) - want)) best = s;
  return best.size;
}
