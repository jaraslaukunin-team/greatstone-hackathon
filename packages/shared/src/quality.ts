import type { PhotoMeta } from './layout';
import type { Layout, Page } from './types';

export const CELL_WIDTH_FRACTION: Record<Page['template'], number> = {
  one: 1,
  two: 1,
  three: 0.5,
  four: 0.5,
  // Одно фото во всю страницу, а не через разворот, поэтому как «one».
  'spread-one': 1,
};

const LOW_DPI = 150;
const VERY_LOW_DPI = 100;

export type QualityIssue = {
  kind: 'empty-cell' | 'missing-photo' | 'low-dpi' | 'very-low-dpi';
  severity: 'blocker' | 'warning';
  pageIndex: number;
  cellIndex: number;
  dpi?: number;
};

// An empty cell (photoId null) and a cell whose photoId is absent from `photos` ('missing-photo') are blockers.
export function checkQuality(
  layout: Layout,
  photos: Record<string, PhotoMeta>,
  variant: { pageWidthCm: number },
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  layout.pages.forEach((page, pageIndex) => {
    page.cells.forEach((cell, cellIndex) => {
      if (cell.photoId === null) {
        issues.push({ kind: 'empty-cell', severity: 'blocker', pageIndex, cellIndex });
        return;
      }
      const photo = photos[cell.photoId];
      if (!photo) {
        issues.push({ kind: 'missing-photo', severity: 'blocker', pageIndex, cellIndex });
        return;
      }
      // Скрытый слой с фото не печатается, поэтому на резкость не проверяется.
      if (cell.hidden) return;
      // Свободный слой: ширина берётся из его рамки, а не из шаблона.
      const cellInches = (variant.pageWidthCm / 2.54) * (cell.frame ? cell.frame.w : CELL_WIDTH_FRACTION[page.template]);
      const dpi = photo.width / cell.crop.scale / cellInches;
      if (dpi < VERY_LOW_DPI) issues.push({ kind: 'very-low-dpi', severity: 'warning', pageIndex, cellIndex, dpi });
      else if (dpi < LOW_DPI) issues.push({ kind: 'low-dpi', severity: 'warning', pageIndex, cellIndex, dpi });
    });
  });
  return issues;
}
