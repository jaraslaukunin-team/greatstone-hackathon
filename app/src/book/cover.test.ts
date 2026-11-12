import type { Layout } from '@picpac/shared';
import { COVER_COLORS, coverPage, coverTitle, SPINE_MIN_PAGES, spineAllowed } from './cover';

const crop = { x: 0, y: 0, scale: 1, rotation: 0 as const };
const layout = (cover?: Layout['cover']): Layout => ({
  pages: [{ template: 'two', cells: [{ photoId: 'first', crop }, { photoId: 'second', crop }] }],
  ...(cover ? { cover } : {}),
});

describe('spineAllowed', () => {
  it('текст на корешке — от 40 страниц', () => {
    expect(SPINE_MIN_PAGES).toBe(40);
    expect(spineAllowed(38)).toBe(false);
    expect(spineAllowed(39)).toBe(false);
    expect(spineAllowed(40)).toBe(true);
    expect(spineAllowed(60)).toBe(true);
  });
});

describe('coverPage', () => {
  it('без своей обложки берётся первая страница книги', () => {
    expect(coverPage(layout())?.template).toBe('two');
  });

  it('с выбранным фото обложка — одно фото во всю страницу, заполняя кадр', () => {
    const page = coverPage(layout({ photoId: 'chosen', title: 'Лето' }));
    expect(page).toEqual({ template: 'spread-one', cells: [{ photoId: 'chosen', crop, fit: 'cover' }] });
  });

  it('обложка без фото возвращается к первой странице', () => {
    expect(coverPage(layout({ photoId: null, title: 'Лето' }))?.template).toBe('two');
  });

  it('пустая книга без обложки не ломает расчёт', () => {
    expect(coverPage({ pages: [] })).toBeNull();
  });
});

describe('coverTitle', () => {
  it('название обложки важнее названия проекта; пустое или из пробелов — название проекта', () => {
    expect(coverTitle(layout({ photoId: null, title: 'Лето' }), 'Книга')).toBe('Лето');
    expect(coverTitle(layout({ photoId: null, title: '   ' }), 'Книга')).toBe('Книга');
    expect(coverTitle(layout(), 'Книга')).toBe('Книга');
  });
});

describe('COVER_COLORS', () => {
  it('четыре цвета ткани как в макете', () => {
    expect(COVER_COLORS).toEqual(['#F6EFE6', '#EDD5D5', '#CFE0DB', '#364C49']);
  });
});
