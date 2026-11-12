import type { BookTheme, Cell, Frame, Layout, PageText, PageTextStyle } from '@picpac/shared';
import { cellRects } from './cellRects';

/** Ссылка на слой: фото-слой (ячейка) или подпись; index — позиция в cells / texts страницы. */
export type LayerRef = { kind: 'cell' | 'text'; pageIndex: number; index: number };
export type LayerInfo = { ref: LayerRef; name: string; hidden: boolean; locked: boolean; photoId: string | null };

const MAX_CELLS = 60;
const MAX_TEXTS = 20;
const NEUTRAL: Cell['crop'] = { x: 0, y: 0, scale: 1, rotation: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function cloneLayout(layout: Layout): Layout {
  return JSON.parse(JSON.stringify(layout)) as Layout;
}

/** Поворот в диапазоне -180..180 (180 превращается в -180). */
function normRot(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

export function clampFrame(f: Frame): Frame {
  return {
    x: clamp(f.x, -0.1, 1.1),
    y: clamp(f.y, -0.1, 1.1),
    w: clamp(f.w, 0.05, 1.2),
    h: clamp(f.h, 0.05, 1.2),
    rot: normRot(f.rot),
  };
}

/** Прямоугольник слоя в пикселях страницы и его поворот. */
export function frameRect(f: Frame, width: number, height: number) {
  const w = f.w * width;
  const h = f.h * height;
  return { left: f.x * width - w / 2, top: f.y * height - h / 2, width: w, height: h, rotate: f.rot };
}

type Target = { cell: Cell; text?: undefined } | { text: PageText; cell?: undefined };

function target(layout: Layout, ref: LayerRef): Target | null {
  const page = layout.pages[ref.pageIndex];
  if (!page) return null;
  if (ref.kind === 'cell') {
    const cell = page.cells[ref.index];
    return cell ? { cell } : null;
  }
  const text = page.texts?.[ref.index];
  return text ? { text } : null;
}

const isLocked = (t: Target) => Boolean(t.cell ? t.cell.locked : t.text?.locked);

/**
 * Включает свободный режим на странице: каждая ячейка по шаблону получает рамку с тем же положением и размером,
 * поэтому вид страницы не меняется. Ячейки, уже имеющие рамку, не трогаются.
 */
export function enableFree(layout: Layout, pageIndex: number, theme: BookTheme, size: { width: number; height: number }): Layout {
  const next = cloneLayout(layout);
  const page = next.pages[pageIndex];
  if (!page) return next;
  const rects = cellRects(page.template, size.width, size.height, page.cells.length, theme, page.gap);
  page.cells.forEach((cell, i) => {
    const r = rects[i];
    if (cell.frame || !r) return;
    cell.frame = {
      x: (r.x + r.width / 2) / size.width,
      y: (r.y + r.height / 2) / size.height,
      w: r.width / size.width,
      h: r.height / size.height,
      rot: 0,
    };
  });
  return next;
}

/** Слои сверху вниз: подписи, затем фото-слои (последний в cells — самый верхний). */
export function listLayers(layout: Layout, pageIndexes: number[], photoName: (photoId: string) => string): LayerInfo[] {
  const texts: LayerInfo[] = [];
  const cells: LayerInfo[] = [];
  for (const pageIndex of [...pageIndexes].reverse()) {
    const page = layout.pages[pageIndex];
    if (!page) continue;
    const pageTexts = page.texts ?? [];
    for (let index = pageTexts.length - 1; index >= 0; index--) {
      const t = pageTexts[index]!;
      texts.push({ ref: { kind: 'text', pageIndex, index }, name: t.text.slice(0, 18) || 'Подпись', hidden: Boolean(t.hidden), locked: Boolean(t.locked), photoId: null });
    }
    for (let index = page.cells.length - 1; index >= 0; index--) {
      const c = page.cells[index]!;
      cells.push({ ref: { kind: 'cell', pageIndex, index }, name: c.photoId ? photoName(c.photoId) : 'Пустой слой', hidden: Boolean(c.hidden), locked: Boolean(c.locked), photoId: c.photoId });
    }
  }
  return [...texts, ...cells];
}

/** Меняет положение слоя: у фото рамка, у подписи только x, y, rot. Закреплённый слой не меняется. */
export function setFrame(layout: Layout, ref: LayerRef, patch: Partial<Frame>): Layout {
  const next = cloneLayout(layout);
  const t = target(next, ref);
  if (!t || isLocked(t)) return next;
  if (t.cell) {
    if (!t.cell.frame) return next;
    t.cell.frame = clampFrame({ ...t.cell.frame, ...patch });
  } else {
    if (patch.x !== undefined) t.text.x = clamp(patch.x, 0, 1);
    if (patch.y !== undefined) t.text.y = clamp(patch.y, 0, 1);
    if (patch.rot !== undefined) t.text.rot = normRot(patch.rot);
  }
  return next;
}

/** Масштаб фото-слоя с сохранением пропорций в границах 0.05..1.2. У подписи размер задаёт стиль. */
export function resizeKeepAspect(layout: Layout, ref: LayerRef, scale: number): Layout {
  const next = cloneLayout(layout);
  const t = target(next, ref);
  if (!t || !t.cell?.frame || isLocked(t)) return next;
  const f = t.cell.frame;
  const k = clamp(scale, Math.max(0.05 / f.w, 0.05 / f.h), Math.min(1.2 / f.w, 1.2 / f.h));
  t.cell.frame = { ...f, w: f.w * k, h: f.h * k };
  return next;
}

export function rotateBy(layout: Layout, ref: LayerRef, deg: number): Layout {
  const next = cloneLayout(layout);
  const t = target(next, ref);
  if (!t || isLocked(t)) return next;
  if (t.cell) {
    if (!t.cell.frame) return next;
    t.cell.frame.rot = normRot(t.cell.frame.rot + deg);
  } else {
    t.text.rot = normRot((t.text.rot ?? 0) + deg);
  }
  return next;
}

/** Порядок слоёв: front — наверх, back — вниз, forward/backward — на одну позицию. Ссылка возвращается новая. */
export function reorder(layout: Layout, ref: LayerRef, to: 'front' | 'back' | 'forward' | 'backward'): { layout: Layout; ref: LayerRef } {
  const next = cloneLayout(layout);
  const t = target(next, ref);
  const page = next.pages[ref.pageIndex];
  if (!t || !page || isLocked(t)) return { layout: next, ref };
  const list: unknown[] = ref.kind === 'cell' ? page.cells : (page.texts ?? []);
  const last = list.length - 1;
  const at = to === 'front' ? last : to === 'back' ? 0 : clamp(ref.index + (to === 'forward' ? 1 : -1), 0, last);
  if (at === ref.index) return { layout: next, ref };
  const [item] = list.splice(ref.index, 1);
  list.splice(at, 0, item);
  return { layout: next, ref: { ...ref, index: at } };
}

export function toggleHidden(layout: Layout, ref: LayerRef): Layout {
  const next = cloneLayout(layout);
  const t = target(next, ref);
  if (!t) return next;
  if (t.cell) t.cell.hidden = !t.cell.hidden;
  else t.text.hidden = !t.text.hidden;
  return next;
}

export function toggleLocked(layout: Layout, ref: LayerRef): Layout {
  const next = cloneLayout(layout);
  const t = target(next, ref);
  if (!t) return next;
  if (t.cell) t.cell.locked = !t.cell.locked;
  else t.text.locked = !t.text.locked;
  return next;
}

/** Убирает слой; фото остаётся в проекте. Закреплённый слой не удаляется. */
export function removeLayer(layout: Layout, ref: LayerRef): Layout {
  const next = cloneLayout(layout);
  const t = target(next, ref);
  const page = next.pages[ref.pageIndex];
  if (!t || !page || isLocked(t)) return next;
  if (ref.kind === 'cell') page.cells.splice(ref.index, 1);
  else page.texts?.splice(ref.index, 1);
  return next;
}

/** Новое фото сверху страницы: ширина 0.5, высота по пропорциям фото (страницы квадратные). ref = null, если слоёв уже максимум. */
export function addPhotoLayer(layout: Layout, pageIndex: number, photoId: string, aspect: number): { layout: Layout; ref: LayerRef | null } {
  const next = cloneLayout(layout);
  const page = next.pages[pageIndex];
  if (!page || page.cells.length >= MAX_CELLS) return { layout: next, ref: null };
  const a = aspect > 0 ? aspect : 1;
  let w = 0.5;
  let h = w / a;
  if (h > 0.9) {
    h = 0.9;
    w = h * a;
  }
  page.cells.push({ photoId, crop: { ...NEUTRAL }, fit: 'cover', border: true, frame: { x: 0.5, y: 0.5, w, h, rot: 0 } });
  return { layout: next, ref: { kind: 'cell', pageIndex, index: page.cells.length - 1 } };
}

export function addTextLayer(layout: Layout, pageIndex: number, style: PageTextStyle, sample: string): { layout: Layout; ref: LayerRef | null } {
  const next = cloneLayout(layout);
  const page = next.pages[pageIndex];
  if (!page || (page.texts?.length ?? 0) >= MAX_TEXTS) return { layout: next, ref: null };
  page.texts = [...(page.texts ?? []), { text: sample, x: 0.5, y: 0.5, style }];
  return { layout: next, ref: { kind: 'text', pageIndex, index: page.texts.length - 1 } };
}

/**
 * Перенос слоя на соседнюю страницу разворота: уходит с одной и появляется наверху другой.
 * x — положение центра в долях исходной страницы (за краем: >1 или <0); на новой странице оно сдвигается на целую страницу.
 */
export function moveAcrossFold(layout: Layout, ref: LayerRef, targetPage: number, x: number): { layout: Layout; ref: LayerRef } {
  const next = cloneLayout(layout);
  const t = target(next, ref);
  const from = next.pages[ref.pageIndex];
  const to = next.pages[targetPage];
  if (!t || !from || !to || targetPage === ref.pageIndex || isLocked(t)) return { layout: next, ref };
  const shifted = targetPage > ref.pageIndex ? x - 1 : x + 1;
  if (t.cell) {
    if (!t.cell.frame || to.cells.length >= MAX_CELLS) return { layout: next, ref };
    const [cell] = from.cells.splice(ref.index, 1);
    cell!.frame = clampFrame({ ...cell!.frame!, x: shifted });
    to.cells.push(cell!);
    return { layout: next, ref: { kind: 'cell', pageIndex: targetPage, index: to.cells.length - 1 } };
  }
  if ((to.texts?.length ?? 0) >= MAX_TEXTS) return { layout: next, ref };
  const [text] = from.texts!.splice(ref.index, 1);
  text!.x = clamp(shifted, 0, 1);
  to.texts = [...(to.texts ?? []), text!];
  return { layout: next, ref: { kind: 'text', pageIndex: targetPage, index: to.texts.length - 1 } };
}
