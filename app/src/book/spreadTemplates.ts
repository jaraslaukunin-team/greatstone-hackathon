import { fitRect, type Cell, type Layout, type Page, type Template } from '@picpac/shared';
import { spreadsOf } from './flip';

export type SpreadTemplateId = 'accent' | 'diptych' | 'story' | 'rhythm' | 'mosaic' | 'panorama';
export type SpreadTemplate = {
  id: SpreadTemplateId;
  title: string;
  /** Сколько фото укладывается в шаблон целиком. */
  photos: number;
  left: Template;
  /** null — правая страница разворота не меняется. */
  right: Template | null;
};
export type PhotoSize = { width: number; height: number };

export const SPREAD_TEMPLATES: readonly SpreadTemplate[] = [
  { id: 'accent', title: 'Акцент', photos: 1, left: 'one', right: null },
  { id: 'diptych', title: 'Диптих', photos: 2, left: 'one', right: 'one' },
  { id: 'story', title: 'История', photos: 3, left: 'one', right: 'two' },
  { id: 'rhythm', title: 'Ритм', photos: 4, left: 'two', right: 'two' },
  { id: 'mosaic', title: 'Мозаика', photos: 6, left: 'four', right: 'two' },
  { id: 'panorama', title: 'Панорама', photos: 1, left: 'spread-one', right: 'spread-one' },
];

export function spreadTemplatesByPhotos(filter: 'all' | '1' | '2-3' | '4-6'): SpreadTemplate[] {
  const ok = (n: number) => (filter === 'all' ? true : filter === '1' ? n === 1 : filter === '2-3' ? n >= 2 && n <= 3 : n >= 4 && n <= 6);
  return SPREAD_TEMPLATES.filter((t) => ok(t.photos));
}

const CELLS: Record<Template, number> = { one: 1, 'spread-one': 1, two: 2, three: 3, four: 4 };
const NEUTRAL: Cell['crop'] = { x: 0, y: 0, scale: 1, rotation: 0 };

function cloneLayout(layout: Layout): Layout {
  return JSON.parse(JSON.stringify(layout)) as Layout;
}

function emptyCells(template: Template): Cell[] {
  return Array.from({ length: CELLS[template] }, () => ({ photoId: null, crop: { ...NEUTRAL } }));
}

/** Масштаб, при котором одно фото закрывает обе страницы разворота (страницы квадратные, как у форматов книги). */
function panoramaScale(size: PhotoSize | undefined): number {
  if (!size || size.width <= 0 || size.height <= 0) return 1;
  const onPage = fitRect(size, { width: 1, height: 1 }, 'cover').width;
  const onSpread = fitRect(size, { width: 2, height: 1 }, 'cover').width;
  return Math.max(1, onSpread / onPage);
}

/**
 * Применяет шаблон к одному развороту (индекс из spreadsOf; обложка не меняется).
 * Фото берутся со страниц разворота в порядке чтения и раскладываются по ячейкам нового шаблона;
 * лишние снимаются со страниц, но остаются в проекте. Фон, подписи и отступы страниц сохраняются.
 */
export function applySpreadTemplate(
  layout: Layout,
  spreadIndex: number,
  id: SpreadTemplateId,
  photos?: Record<string, PhotoSize>,
): Layout {
  const next = cloneLayout(layout);
  const template = SPREAD_TEMPLATES.find((t) => t.id === id);
  const spread = spreadsOf(next.pages.length)[spreadIndex];
  if (!template || !spread || spreadIndex < 1) return next;

  const [leftIndex, rightIndex] = spread;
  const left = leftIndex === null ? undefined : next.pages[leftIndex];
  const right = rightIndex === null || template.right === null ? undefined : next.pages[rightIndex];
  if (!left) return next;

  const found = [left, right].flatMap((p) => (p ? p.cells.map((c) => c.photoId) : [])).filter((x): x is string => Boolean(x));

  if (id === 'panorama') {
    const photoId = found[0] ?? null;
    const scale = panoramaScale(photoId ? photos?.[photoId] : undefined);
    const panoCell = (x: number): Cell => ({
      photoId,
      crop: { x: photoId ? x : 0, y: 0, scale, rotation: 0 },
      fit: 'cover',
    });
    left.template = 'spread-one';
    // На развороте из одной страницы фото не делится: оно просто закрывает страницу.
    left.cells = [right ? panoCell(0.5) : { ...panoCell(0), crop: { ...NEUTRAL } }];
    if (right) {
      right.template = 'spread-one';
      right.cells = [panoCell(-0.5)];
    }
    return next;
  }

  const fill = (page: Page, pageTemplate: Template, from: number): number => {
    page.template = pageTemplate;
    page.cells = emptyCells(pageTemplate);
    page.cells.forEach((cell, i) => {
      cell.photoId = found[from + i] ?? null;
    });
    return from + page.cells.length;
  };
  const used = fill(left, template.left, 0);
  if (right && template.right) fill(right, template.right, used);
  return next;
}

/** Тот же шаблон на всех разворотах, кроме обложки; у каждого разворота остаются его собственные фото. */
export function applySpreadTemplateToAll(layout: Layout, id: SpreadTemplateId, photos?: Record<string, PhotoSize>): Layout {
  let next = cloneLayout(layout);
  const count = spreadsOf(next.pages.length).length;
  for (let i = 1; i < count; i++) next = applySpreadTemplate(next, i, id, photos);
  return next;
}
