import type { Cell, Layout, Page, ThemeId } from '@picpac/shared';

export type CellRef = { pageIndex: number; cellIndex: number };

function cloneLayout(layout: Layout): Layout {
  return JSON.parse(JSON.stringify(layout)) as Layout;
}

export function swapCells(layout: Layout, a: CellRef, b: CellRef): Layout {
  const next = cloneLayout(layout);
  const cellA = next.pages[a.pageIndex]?.cells[a.cellIndex];
  const cellB = next.pages[b.pageIndex]?.cells[b.cellIndex];
  if (!cellA || !cellB) return next;
  const photoA = cellA.photoId;
  cellA.photoId = cellB.photoId;
  cellB.photoId = photoA;
  return next;
}

export function moveSpread(layout: Layout, from: number, to: number): Layout {
  const next = cloneLayout(layout);
  if (from < 0 || to < 0 || from >= next.pages.length || to >= next.pages.length) return next;
  const [page] = next.pages.splice(from, 1);
  if (!page) return next;
  next.pages.splice(to, 0, page);
  return next;
}

export function setCrop(layout: Layout, ref: CellRef, crop: Cell['crop']): Layout {
  const next = cloneLayout(layout);
  const cell = next.pages[ref.pageIndex]?.cells[ref.cellIndex];
  if (!cell) return next;
  cell.crop = {
    ...crop,
    scale: Math.max(1, crop.scale),
  };
  return next;
}

export function applyTemplate(layout: Layout, pageIndex: number, template: Page['template']): Layout {
  const next = cloneLayout(layout);
  const page = next.pages[pageIndex];
  if (!page) return next;
  const keep = page.cells.map((c) => c.photoId);
  const count = template === 'one' || template === 'spread-one' ? 1 : template === 'two' ? 2 : 4;
  page.template = template;
  page.cells = Array.from({ length: count }, (_, i) => ({
    photoId: keep[i] ?? null,
    crop: { x: 0, y: 0, scale: 1, rotation: 0 as const },
  }));
  return next;
}

/** «Целиком» вписывает фото с полями (кадр сбрасывается), «Заполнить» закрывает ячейку и позволяет двигать кадр. */
export function setFit(layout: Layout, ref: CellRef, fit: NonNullable<Cell['fit']>): Layout {
  const next = cloneLayout(layout);
  const cell = next.pages[ref.pageIndex]?.cells[ref.cellIndex];
  if (!cell) return next;
  cell.fit = fit;
  if (fit === 'contain') cell.crop = { ...cell.crop, x: 0, y: 0, scale: 1 };
  return next;
}

/** Убирает фото из ячейки вместе с кадром; само фото остаётся в проекте. */
export function clearPhoto(layout: Layout, ref: CellRef): Layout {
  const next = cloneLayout(layout);
  const cell = next.pages[ref.pageIndex]?.cells[ref.cellIndex];
  if (!cell) return next;
  cell.photoId = null;
  cell.crop = { x: 0, y: 0, scale: 1, rotation: 0 };
  delete cell.fit;
  return next;
}

/** Пустая страница на одно фото вставляется перед индексом at; за краем — в конец. */
export function insertPage(layout: Layout, at: number): Layout {
  const next = cloneLayout(layout);
  const index = Math.min(next.pages.length, Math.max(0, at));
  next.pages.splice(index, 0, {
    template: 'one',
    cells: [{ photoId: null, crop: { x: 0, y: 0, scale: 1, rotation: 0 as const } }],
  });
  return next;
}

/** Убирает страницу; индекс вне диапазона и единственная страница книги остаются как есть. */
export function removePage(layout: Layout, at: number): Layout {
  const next = cloneLayout(layout);
  if (at < 0 || at >= next.pages.length || next.pages.length <= 1) return next;
  next.pages.splice(at, 1);
  return next;
}

export function setTheme(layout: Layout, themeId: ThemeId): Layout {
  return { ...cloneLayout(layout), themeId };
}

export function replacePhoto(layout: Layout, ref: CellRef, photoId: string): Layout {
  const next = cloneLayout(layout);
  const cell = next.pages[ref.pageIndex]?.cells[ref.cellIndex];
  if (!cell) return next;
  cell.photoId = photoId;
  return next;
}
