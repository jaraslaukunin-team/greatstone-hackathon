import type { Layout, Page } from '@picpac/shared';
import { pageTiles, spreadPhotoCount, spreadRange } from './spreadInfo';

const crop = { x: 0, y: 0, scale: 1, rotation: 0 as const };
const page = (...ids: (string | null)[]): Page => ({ template: 'two', cells: ids.map((photoId) => ({ photoId, crop })) });
const book = (n: number): Layout => ({ pages: Array.from({ length: n }, (_, i) => page(`p${i}`)) });

describe('spreadRange', () => {
  it('20 страниц: «1 · Начало», «2–3», «18–19», «20 · Финал»', () => {
    expect(spreadRange(0, 20)).toBe('1 · Начало');
    expect(spreadRange(1, 20)).toBe('2–3');
    expect(spreadRange(9, 20)).toBe('18–19');
    expect(spreadRange(10, 20)).toBe('20 · Финал');
  });
  it('19 страниц: последний разворот парный', () => {
    expect(spreadRange(9, 19)).toBe('18–19');
  });
  it('единственная страница — «1 · Начало»', () => {
    expect(spreadRange(0, 1)).toBe('1 · Начало');
  });
});

describe('spreadPhotoCount', () => {
  it('считает только непустые ячейки обеих страниц разворота', () => {
    const layout: Layout = { pages: [page('x'), page('a', null), page('b', 'c')] };
    expect(spreadPhotoCount(layout, 1)).toBe(3);
    expect(spreadPhotoCount(layout, 0)).toBe(1);
  });
});

describe('pageTiles', () => {
  it('20 страниц: обложка + 11 разворотов = 12 плиток с нужными подписями', () => {
    const tiles = pageTiles(book(20), []);
    expect(tiles).toHaveLength(12);
    expect(tiles[0]).toMatchObject({ kind: 'cover', caption: 'Обложка', spreadIndex: 0 });
    expect(tiles[1]).toMatchObject({ kind: 'spread', caption: '1 · Начало', spreadIndex: 0 });
    expect(tiles[2]?.caption).toBe('2–3');
    expect(tiles[11]).toMatchObject({ kind: 'spread', caption: '20 · Финал', spreadIndex: 10 });
  });
  it('замечания попадают в плитку своего разворота, у обложки их нет', () => {
    const tiles = pageTiles(book(5), [[], ['empty'], ['blurry']]);
    expect(tiles[0]?.issues).toEqual([]);
    expect(tiles[2]?.issues).toEqual(['empty']);
    expect(tiles[3]?.issues).toEqual(['blurry']);
  });
});
