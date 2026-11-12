import type { Layout, PhotoMeta } from '@picpac/shared';
import { spreadIssues } from './spreadIssues';

const crop = { x: 0, y: 0, scale: 1, rotation: 0 as const };
const meta = (id: string, width: number): PhotoMeta => ({ id, width, height: Math.round(width * 0.67), takenAt: null });
const variant = { pageWidthCm: 20 };

function layoutOf(photoIds: Array<string | null>): Layout {
  return { pages: photoIds.map((photoId) => ({ template: 'one' as const, cells: [{ photoId, crop: { ...crop } }] })) };
}

// 5 страниц → развороты: [—,0], [1,2], [3,4]
describe('spreadIssues', () => {
  const photos = { good: meta('good', 4000), small: meta('small', 600) };

  it('даёт по списку на каждый разворот, включая обложку', () => {
    expect(spreadIssues(layoutOf(['good', 'good', 'good', 'good', 'good']), photos, variant)).toEqual([[], [], []]);
  });

  it('пустая ячейка — «пусто», а страница 0 относится к обложке', () => {
    const r = spreadIssues(layoutOf([null, 'good', 'good', 'good', 'good']), photos, variant);
    expect(r[0]).toEqual(['empty']);
    expect(r[1]).toEqual([]);
  });

  it('страница в середине книги относится к своему развороту', () => {
    const r = spreadIssues(layoutOf(['good', 'good', null, 'good', 'good']), photos, variant);
    expect(r[1]).toEqual(['empty']);
    expect(r[2]).toEqual([]);
  });

  it('маленькое фото на 20 см даёт «нерезко»', () => {
    const r = spreadIssues(layoutOf(['good', 'good', 'good', 'small', 'good']), photos, variant);
    expect(r[2]).toEqual(['blurry']);
  });

  it('фото, которого нет в проекте, считается пустым местом', () => {
    const r = spreadIssues(layoutOf(['good', 'ghost', 'good', 'good', 'good']), photos, variant);
    expect(r[1]).toEqual(['empty']);
  });

  it('пусто и нерезко вместе: сначала «пусто», без повторов', () => {
    const layout: Layout = {
      pages: [
        { template: 'one', cells: [{ photoId: 'good', crop }] },
        { template: 'two', cells: [{ photoId: null, crop }, { photoId: 'small', crop }] },
        { template: 'one', cells: [{ photoId: 'small', crop }] },
      ],
    };
    // развороты: [—,0], [1,2]
    expect(spreadIssues(layout, photos, variant)[1]).toEqual(['empty', 'blurry']);
  });

  it('приближение кадра ухудшает качество', () => {
    const layout = layoutOf(['good', 'good']);
    layout.pages[1]!.cells[0]!.crop = { ...crop, scale: 4 };
    expect(spreadIssues(layout, photos, variant)[1]).toEqual(['blurry']);
  });

  it('пустая книга не ломает расчёт', () => {
    expect(spreadIssues({ pages: [] }, photos, variant)).toEqual([[]]);
  });
});
