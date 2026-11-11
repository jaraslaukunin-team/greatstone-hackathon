import type { Size } from '@picpac/shared';

/** Размер отпечатка из названия формата каталога: «10×15 глянцевая» → 10 на 15. */
export function frameSizeOf(format: string): Size | null {
  const m = /(\d+(?:[.,]\d+)?)\s*[×xх]\s*(\d+(?:[.,]\d+)?)/i.exec(format);
  if (!m) return null;
  return { width: Number(m[1]!.replace(',', '.')), height: Number(m[2]!.replace(',', '.')) };
}

/** Отпечаток печатается в ориентации фото: горизонтальное фото — горизонтальный кадр. */
export function orientFrame(frame: Size, photo: Size): Size {
  const photoLandscape = photo.width > photo.height;
  const framePortrait = frame.height > frame.width;
  const frameLandscape = frame.width > frame.height;
  if (photoLandscape && framePortrait) return { width: frame.height, height: frame.width };
  if (photo.height > photo.width && frameLandscape) return { width: frame.height, height: frame.width };
  return frame;
}
