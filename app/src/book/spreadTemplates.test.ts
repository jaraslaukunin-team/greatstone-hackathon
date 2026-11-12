import type { Layout, Page } from '@picpac/shared';
import { unplacedPhotos } from '../editor/autoLayoutLocal';
import { applySpreadTemplate, applySpreadTemplateToAll, SPREAD_TEMPLATES, spreadTemplatesByPhotos } from './spreadTemplates';

const crop = { x: 0, y: 0, scale: 1, rotation: 0 as const };
const page = (...ids: (string | null)[]): Page => ({
  template: ids.length === 1 ? 'one' : 'two',
  cells: ids.map((photoId) => ({ photoId, crop })),
});
const ids = (p: Page | undefined) => p?.cells.map((c) => c.photoId);
// Обложка (pages[0]) + разворот 1 (pages[1], pages[2]) + разворот 2 (pages[3], pages[4]).
const base = (): Layout => ({ pages: [page('x'), page('a'), page('b', 'c'), page('d'), page('e')] });

describe('SPREAD_TEMPLATES', () => {
  it('шесть шаблонов с нужным числом фото', () => {
    expect(SPREAD_TEMPLATES.map((t) => [t.id, t.photos])).toEqual([
      ['accent', 1],
      ['diptych', 2],
      ['story', 3],
      ['rhythm', 4],
      ['mosaic', 6],
      ['panorama', 1],
    ]);
  });
  it('spreadTemplatesByPhotos фильтрует по числу фото', () => {
    const f = (k: Parameters<typeof spreadTemplatesByPhotos>[0]) => spreadTemplatesByPhotos(k).map((t) => t.id);
    expect(f('all')).toHaveLength(6);
    expect(f('1')).toEqual(['accent', 'panorama']);
    expect(f('2-3')).toEqual(['diptych', 'story']);
    expect(f('4-6')).toEqual(['rhythm', 'mosaic']);
  });
});

describe('applySpreadTemplate', () => {
  it('История: страница one и страница two, фото в порядке чтения', () => {
    const r = applySpreadTemplate(base(), 1, 'story');
    expect(r.pages[1]?.template).toBe('one');
    expect(r.pages[2]?.template).toBe('two');
    expect(ids(r.pages[1])).toEqual(['a']);
    expect(ids(r.pages[2])).toEqual(['b', 'c']);
  });

  it('фото больше ячеек: лишнее снимается со страницы, но остаётся в проекте как неразмещённое', () => {
    const r = applySpreadTemplate(base(), 1, 'accent');
    expect(r.pages).toHaveLength(5);
    expect(ids(r.pages[1])).toEqual(['a']);
    // Акцент меняет только левую страницу: правая не тронута.
    expect(ids(r.pages[2])).toEqual(['b', 'c']);
    const photos = ['a', 'b', 'c', 'd', 'e', 'x'].map((id) => ({ id, width: 4, height: 3, takenAt: null }));
    const r2 = applySpreadTemplate(base(), 1, 'diptych');
    expect(unplacedPhotos(r2, photos).map((p) => p.id)).toEqual(['c']);
  });

  it('пустые ячейки остаются пустыми, если фото меньше', () => {
    const r = applySpreadTemplate(base(), 1, 'mosaic');
    expect(r.pages[1]?.template).toBe('four');
    expect(r.pages[2]?.template).toBe('two');
    expect(ids(r.pages[1])).toEqual(['a', 'b', 'c', null]);
    expect(ids(r.pages[2])).toEqual([null, null]);
  });

  it('панорама: обе страницы spread-one, один photoId, сдвиг +0.5 и −0.5, fit cover', () => {
    const r = applySpreadTemplate(base(), 1, 'panorama');
    const [l, rr] = [r.pages[1]!, r.pages[2]!];
    expect([l.template, rr.template]).toEqual(['spread-one', 'spread-one']);
    expect(ids(l)).toEqual(['a']);
    expect(ids(rr)).toEqual(['a']);
    expect(l.cells[0]).toMatchObject({ fit: 'cover', crop: { x: 0.5, y: 0, rotation: 0 } });
    expect(rr.cells[0]).toMatchObject({ fit: 'cover', crop: { x: -0.5, y: 0, rotation: 0 } });
  });

  it('масштаб панорамы берётся из пропорций фото', () => {
    const wide = applySpreadTemplate(base(), 1, 'panorama', { a: { width: 4000, height: 2000 } });
    expect(wide.pages[1]?.cells[0]?.crop.scale).toBeCloseTo(1);
    const square = applySpreadTemplate(base(), 1, 'panorama', { a: { width: 3000, height: 3000 } });
    expect(square.pages[1]?.cells[0]?.crop.scale).toBeCloseTo(2);
  });

  it('bg, texts, gap страниц сохраняются; обложка и число страниц не меняются', () => {
    const layout = base();
    layout.cover = { photoId: 'x', title: 'Т' };
    layout.pages[1] = { ...layout.pages[1]!, bg: '#EDD5D5', gap: 0.05, texts: [{ text: 'Привет', x: 0.5, y: 0.5, style: 'caption' }] };
    const r = applySpreadTemplate(layout, 1, 'story');
    expect(r.pages[1]).toMatchObject({ bg: '#EDD5D5', gap: 0.05, texts: layout.pages[1]!.texts });
    expect(r.pages).toHaveLength(5);
    expect(r.cover).toEqual(layout.cover);
    expect(layout.pages[1]?.template).toBe('one'); // исходный макет не изменён
  });

  it('разворот из одной страницы: диптих пишет только левую, страниц не добавляется', () => {
    const layout: Layout = { pages: [page('x'), page('a'), page('b', 'c'), page('d')] }; // разворот 2 = pages[3] один
    const r = applySpreadTemplate(layout, 2, 'diptych');
    expect(r.pages).toHaveLength(4);
    expect(ids(r.pages[3])).toEqual(['d']);
  });

  it('разворот 0 и индекс вне диапазона возвращают макет без изменений', () => {
    const layout = base();
    expect(applySpreadTemplate(layout, 0, 'story')).toEqual(layout);
    expect(applySpreadTemplate(layout, 9, 'story')).toEqual(layout);
  });
});

describe('панорама и кадры', () => {
  it('после панорамы другой шаблон не дублирует фото', () => {
    const pano = applySpreadTemplate(base(), 1, 'panorama');
    const r = applySpreadTemplate(pano, 1, 'diptych');
    expect(ids(r.pages[1])).toEqual(['a']);
    expect(ids(r.pages[2])).toEqual([null]);
  });
  it('кадр и fit фото сохраняются, если оно осталось в шаблоне', () => {
    const layout = base();
    layout.pages[1] = { template: 'one', cells: [{ photoId: 'a', crop: { x: 0.1, y: 0, scale: 2, rotation: 0 }, fit: 'cover' }] };
    const r = applySpreadTemplate(layout, 1, 'diptych');
    expect(r.pages[1]?.cells[0]).toMatchObject({ photoId: 'a', fit: 'cover', crop: { x: 0.1, scale: 2 } });
  });
  it('кадр панорамы не переходит в обычную ячейку', () => {
    const pano = applySpreadTemplate(base(), 1, 'panorama');
    const r = applySpreadTemplate(pano, 1, 'diptych');
    expect(r.pages[1]?.cells[0]?.crop).toEqual({ x: 0, y: 0, scale: 1, rotation: 0 });
    expect(r.pages[1]?.cells[0]?.fit).toBeUndefined();
  });
});

describe('applySpreadTemplateToAll', () => {
  it('применяет ко всем разворотам, кроме обложки', () => {
    const r = applySpreadTemplateToAll(base(), 'diptych');
    expect(r.pages[0]).toEqual(base().pages[0]);
    expect(r.pages[1]?.template).toBe('one');
    expect(r.pages[2]?.template).toBe('one');
    expect(r.pages[3]?.template).toBe('one');
    expect(ids(r.pages[3])).toEqual(['d']);
  });
});
