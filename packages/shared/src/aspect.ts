// Пропорции кадра и вписывание фото без растяжения.
export const ASPECT_RATIOS = ['original', '1:1', '4:3', '3:2', '16:9', '5:7'] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type FitMode = 'contain' | 'cover';
export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** Ширина к высоте. `original` — пропорция самого фото; без фото считаем квадрат. */
export function aspectValue(aspect: AspectRatio, photo?: Size): number {
  if (aspect === 'original') return photo && photo.height > 0 ? photo.width / photo.height : 1;
  const [w, h] = aspect.split(':').map(Number);
  return w! / h!;
}

/**
 * Прямоугольник фото внутри кадра. Масштаб одинаковый по обеим осям, поэтому фото никогда не растягивается:
 * contain вписывает целиком (остаются поля), cover заполняет кадр (лишнее выходит за края).
 */
export function fitRect(photo: Size, frame: Size, mode: FitMode): Rect {
  const sx = frame.width / photo.width;
  const sy = frame.height / photo.height;
  const scale = mode === 'contain' ? Math.min(sx, sy) : Math.max(sx, sy);
  const width = photo.width * scale;
  const height = photo.height * scale;
  return { x: (frame.width - width) / 2, y: (frame.height - height) / 2, width, height };
}
