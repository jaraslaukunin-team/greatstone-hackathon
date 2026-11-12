import type { Cell, Cover, Layout, Page, PageText, ThemeId } from '@picpac/shared';
import { spreadsOf } from '../book/flip';

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
  const count = { one: 1, 'spread-one': 1, two: 2, three: 3, four: 4 }[template];
  page.template = template;
  page.cells = Array.from({ length: count }, (_, i) => ({
    photoId: keep[i] ?? null,
    crop: { x: 0, y: 0, scale: 1, rotation: 0 as const },
  }));
  return next;
}

/**
 * Сдвигает разворот целиком (обе его страницы) на соседнее место: dir −1 — назад, 1 — вперёд.
 * Обложка (разворот 0) не двигается и не уступает место; последний разворот может быть из одной страницы.
 */
export function moveSpreadBy(layout: Layout, spreadIndex: number, dir: -1 | 1): Layout {
  const next = cloneLayout(layout);
  const spreads = spreadsOf(next.pages.length);
  const target = spreadIndex + dir;
  if (spreadIndex < 1 || spreadIndex >= spreads.length || target < 1 || target >= spreads.length) return next;
  const order = spreads.map((_, i) => i);
  [order[spreadIndex], order[target]] = [order[target]!, order[spreadIndex]!];
  const pageOrder = order.flatMap((i) => spreads[i]!.filter((p): p is number => p !== null));
  const pages = next.pages;
  next.pages = pageOrder.map((p) => pages[p]!);
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

const MAX_COVER_TEXT = 100;

/**
 * Правка обложки. Первый вызов создаёт её из названия проекта; пустые подзаголовок и корешок не хранятся.
 */
export function setCover(layout: Layout, patch: Partial<Cover>, fallbackTitle = ''): Layout {
  const next = cloneLayout(layout);
  const merged: Cover = { ...(next.cover ?? { photoId: null, title: fallbackTitle }), ...patch };
  merged.title = merged.title.slice(0, MAX_COVER_TEXT);
  for (const key of ['subtitle', 'spine', 'color'] as const) {
    const value = merged[key]?.trim();
    if (value) merged[key] = value.slice(0, MAX_COVER_TEXT);
    else delete merged[key];
  }
  next.cover = merged;
  return next;
}

/** Цвет фона страницы; null возвращает цвет темы. */
export function setPageBg(layout: Layout, pageIndex: number, bg: string | null): Layout {
  const next = cloneLayout(layout);
  const page = next.pages[pageIndex];
  if (!page) return next;
  if (bg === null) delete page.bg;
  else page.bg = bg;
  return next;
}

export const MAX_PAGE_TEXTS = 20;

export function addPageText(layout: Layout, pageIndex: number, text: PageText): Layout {
  const next = cloneLayout(layout);
  const page = next.pages[pageIndex];
  if (!page) return next;
  const texts = page.texts ?? [];
  if (texts.length >= MAX_PAGE_TEXTS) return next;
  page.texts = [...texts, { ...text }];
  return next;
}

export function updatePageText(layout: Layout, pageIndex: number, index: number, patch: Partial<PageText>): Layout {
  const next = cloneLayout(layout);
  const current = next.pages[pageIndex]?.texts?.[index];
  if (!current) return next;
  Object.assign(current, patch);
  return next;
}

export function removePageText(layout: Layout, pageIndex: number, index: number): Layout {
  const next = cloneLayout(layout);
  const page = next.pages[pageIndex];
  if (!page?.texts?.[index]) return next;
  page.texts = page.texts.filter((_, i) => i !== index);
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

/** Разворот из двух пустых страниц в конец книги; за максимум страниц не выходит. */
export function addSpread(layout: Layout, pagesMax: number): Layout {
  const next = cloneLayout(layout);
  if (next.pages.length + 2 > pagesMax) return next;
  for (let i = 0; i < 2; i++) {
    next.pages.push({ template: 'one', cells: [{ photoId: null, crop: { x: 0, y: 0, scale: 1, rotation: 0 as const } }] });
  }
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
