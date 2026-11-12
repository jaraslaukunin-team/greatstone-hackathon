import type { Layout } from '@picpac/shared';
import { hasContent, markSeen, reconcileLayout } from './reconcileLayout';

const photo = (id: string) => ({ id, width: 4000, height: 3000, takenAt: null });
const crop = { x: 0, y: 0, scale: 1, rotation: 0 as const };
const page = (...ids: (string | null)[]) => ({
  template: 'one' as const,
  cells: ids.map((photoId) => ({ photoId, crop })),
});
const limits = { pagesMin: 1, pagesMax: 10 };
const placed = (l: Layout) => l.pages.flatMap((p) => p.cells.map((c) => c.photoId)).filter(Boolean);

describe('reconcileLayout', () => {
  it('пустой макет раскладывается автоматически и запоминает фото', () => {
    const r = reconcileLayout({ pages: [page(null)] }, [photo('a'), photo('b')], limits);
    expect(placed(r).sort()).toEqual(['a', 'b']);
    expect(r.seen?.sort()).toEqual(['a', 'b']);
  });

  it('сохраняет пустой выбранный шаблон, когда новые фото добавлены в лоток', () => {
    const previous: Layout = { pages: [{ template: 'two', cells: [page(null).cells[0]!, page(null).cells[0]!] }], seen: ['a'] };
    expect(reconcileLayout(previous, [photo('a')], limits)).toBe(previous);
  });

  it('убранное пользователем фото не возвращается, правки остаются', () => {
    const previous: Layout = { pages: [page('a'), page(null)], seen: ['a', 'b'] };
    const r = reconcileLayout(previous, [photo('a'), photo('b')], limits);
    expect(r.pages).toEqual(previous.pages);
    expect(placed(r)).toEqual(['a']);
  });

  it('новое фото добавляется в конец, прежние страницы не трогаются', () => {
    const previous: Layout = { pages: [page('a'), page(null)], seen: ['a', 'b'] };
    const r = reconcileLayout(previous, [photo('a'), photo('b'), photo('c')], limits);
    expect(r.pages.slice(0, 2)).toEqual(previous.pages);
    expect(placed(r)).toEqual(['a', 'c']);
    expect(r.seen).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  it('макет без seen (старый) ничего не добавляет, а запоминает все фото', () => {
    const previous: Layout = { pages: [page('a')] };
    const r = reconcileLayout(previous, [photo('a'), photo('b')], limits);
    expect(r.pages).toEqual(previous.pages);
    expect(r.seen?.sort()).toEqual(['a', 'b']);
  });

  it('не превышает максимум страниц', () => {
    const previous: Layout = { pages: [page('a'), page('b')], seen: ['a', 'b'] };
    const r = reconcileLayout(previous, [photo('a'), photo('b'), photo('c')], { pagesMin: 1, pagesMax: 2 });
    expect(r.pages).toHaveLength(2);
    expect(r.seen).not.toContain('c');
  });

  it('макет только с обложкой или подписью считается работой и не затирается', () => {
    const withCover: Layout = { pages: [page(null)], cover: { photoId: null, title: 'Лето' }, seen: [] };
    expect(hasContent(withCover)).toBe(true);
    const r = reconcileLayout(withCover, [photo('a')], limits);
    expect(r.cover?.title).toBe('Лето');
  });
});

describe('markSeen', () => {
  it('добавляет id без дублей и не создаёт новый объект, если ничего не изменилось', () => {
    const l: Layout = { pages: [], seen: ['a'] };
    expect(markSeen(l, ['a'])).toBe(l);
    expect(markSeen(l, ['a', 'b']).seen).toEqual(['a', 'b']);
  });

  it('скрытый слой с фото считается размещённым и не возвращается как новое фото', () => {
    const hidden = { photoId: 'b', crop, hidden: true, frame: { x: 0.5, y: 0.5, w: 0.4, h: 0.4, rot: 0 } };
    const previous: Layout = { pages: [page('a'), { template: 'one', cells: [hidden] }], seen: ['a'] };
    const r = reconcileLayout(previous, [photo('a'), photo('b')], limits);
    expect(r.pages).toHaveLength(2);
    expect(r.seen).toEqual(expect.arrayContaining(['a', 'b']));
  });
});
