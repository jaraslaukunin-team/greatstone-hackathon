import type { BookTheme, Page, Rect } from '@picpac/shared';

/**
 * Раскладка ячеек страницы по шаблону: 1, 2 в ряд, 4 в сетке 2×2.
 * Поле страницы и зазор между фото берутся из темы (доли ширины страницы).
 * Если ячеек меньше, чем нужно шаблону, рисуется одна.
 */
export function cellRects(template: Page['template'], width: number, height: number, count: number, theme: BookTheme): Rect[] {
  const m = theme.marginPct * width;
  const g = theme.gapPct * width;
  if (template === 'two' && count >= 2) {
    const w = (width - m * 2 - g) / 2;
    return [0, 1].map((i) => ({ x: m + i * (w + g), y: m, width: w, height: height - m * 2 }));
  }
  if (template === 'four' && count >= 4) {
    const w = (width - m * 2 - g) / 2;
    const h = (height - m * 2 - g) / 2;
    return [0, 1, 2, 3].map((i) => ({
      x: m + (i % 2) * (w + g),
      y: m + Math.floor(i / 2) * (h + g),
      width: w,
      height: h,
    }));
  }
  return [{ x: m, y: m, width: width - m * 2, height: height - m * 2 }];
}
