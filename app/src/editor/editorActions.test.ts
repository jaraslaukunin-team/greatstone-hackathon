import {
  addPageText,
  applyTemplate,
  clearPhoto,
  setCover,
  removePageText,
  setPageBg,
  updatePageText,
  insertPage,
  moveSpread,
  moveSpreadBy,
  removePage,
  replacePhoto,
  setCrop,
  setFit,
  setTheme,
  swapCells,
} from './editorActions';
import type { Layout } from '@picpac/shared';

const crop = { x: 0, y: 0, scale: 1, rotation: 0 as const };

function layoutWith(photos: Array<string | null>): Layout {
  return {
    pages: photos.map((photoId) => ({
      template: 'one' as const,
      cells: [{ photoId, crop: { ...crop } }],
    })),
  };
}

describe('setCover', () => {
  it('первый вызов создаёт обложку из названия проекта и применяет правку', () => {
    const next = setCover(layoutWith(['a']), { photoId: 'a' }, 'Книга');
    expect(next.cover).toEqual({ photoId: 'a', title: 'Книга' });
  });

  it('следующие вызовы меняют только указанное', () => {
    let l = setCover(layoutWith(['a']), { photoId: 'a', subtitle: '2026' }, 'Книга');
    l = setCover(l, { title: 'Лето' }, 'Книга');
    expect(l.cover).toEqual({ photoId: 'a', title: 'Лето', subtitle: '2026' });
  });

  it('пустой подзаголовок и корешок убираются, а не хранятся пустыми', () => {
    let l = setCover(layoutWith(['a']), { subtitle: '2026', spine: 'Лето' }, 'Книга');
    l = setCover(l, { subtitle: '', spine: '  ' }, 'Книга');
    expect('subtitle' in (l.cover ?? {})).toBe(false);
    expect('spine' in (l.cover ?? {})).toBe(false);
  });

  it('названия обрезаются до 100 символов, исходный макет цел', () => {
    const input = layoutWith(['a']);
    const next = setCover(input, { title: 'я'.repeat(150) }, 'Книга');
    expect(next.cover?.title).toHaveLength(100);
    expect(input.cover).toBeUndefined();
  });

  it('тема и страницы не меняются', () => {
    const input = { ...layoutWith(['a', 'b']), themeId: 'film' };
    const next = setCover(input, { photoId: 'b' }, 'Книга');
    expect(next.themeId).toBe('film');
    expect(next.pages).toEqual(input.pages);
  });
});

describe('шаблоны three и spread-one', () => {
  it("applyTemplate('three') даёт три ячейки и сохраняет первые фото", () => {
    const next = applyTemplate(layoutWith(['a']), 0, 'three');
    expect(next.pages[0]?.template).toBe('three');
    expect(next.pages[0]?.cells.map((c) => c.photoId)).toEqual(['a', null, null]);
  });

  it("applyTemplate('spread-one') даёт одну ячейку", () => {
    expect(applyTemplate(layoutWith(['a']), 0, 'spread-one').pages[0]?.cells).toHaveLength(1);
  });

  it("applyTemplate('four') по-прежнему даёт четыре", () => {
    expect(applyTemplate(layoutWith(['a']), 0, 'four').pages[0]?.cells).toHaveLength(4);
  });
});

describe('фон и тексты страницы', () => {
  const text = { text: 'Лето', x: 0.5, y: 0.9, style: 'caption' as const };

  it('setPageBg ставит и снимает цвет, исходный макет цел', () => {
    const input = layoutWith(['a']);
    const colored = setPageBg(input, 0, '#EDD5D5');
    expect(colored.pages[0]?.bg).toBe('#EDD5D5');
    expect(input.pages[0]?.bg).toBeUndefined();
    expect('bg' in (setPageBg(colored, 0, null).pages[0] ?? {})).toBe(false);
  });

  it('addPageText добавляет подпись, updatePageText меняет, removePageText убирает', () => {
    let l = addPageText(layoutWith(['a']), 0, text);
    expect(l.pages[0]?.texts).toEqual([text]);
    l = updatePageText(l, 0, 0, { x: 0.2, text: 'Осень' });
    expect(l.pages[0]?.texts?.[0]).toEqual({ ...text, x: 0.2, text: 'Осень' });
    l = removePageText(l, 0, 0);
    expect(l.pages[0]?.texts).toEqual([]);
  });

  it('несуществующая страница или подпись ничего не меняют', () => {
    const input = addPageText(layoutWith(['a']), 0, text);
    expect(setPageBg(input, 5, '#fff')).toEqual(input);
    expect(addPageText(input, 5, text)).toEqual(input);
    expect(updatePageText(input, 0, 3, { x: 0.1 })).toEqual(input);
    expect(removePageText(input, 0, 3)).toEqual(input);
  });

  it('подписи не больше 20 на страницу', () => {
    let l = layoutWith(['a']);
    for (let i = 0; i < 25; i++) l = addPageText(l, 0, text);
    expect(l.pages[0]?.texts).toHaveLength(20);
  });
});

describe('moveSpreadBy', () => {
  const ids = (l: Layout) => l.pages.map((p) => p.cells[0]?.photoId);
  // 7 страниц → развороты: [—,0] [1,2] [3,4] [5,6]
  const seven = () => layoutWith(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6']);

  it('разворот уезжает вперёд вместе с обеими страницами', () => {
    expect(ids(moveSpreadBy(seven(), 1, 1))).toEqual(['p0', 'p3', 'p4', 'p1', 'p2', 'p5', 'p6']);
  });

  it('разворот уезжает назад', () => {
    expect(ids(moveSpreadBy(seven(), 3, -1))).toEqual(['p0', 'p1', 'p2', 'p5', 'p6', 'p3', 'p4']);
  });

  it('последний разворот из одной страницы меняется с соседним без потерь', () => {
    // 6 страниц → [—,0] [1,2] [3,4] [5]
    const six = layoutWith(['p0', 'p1', 'p2', 'p3', 'p4', 'p5']);
    expect(ids(moveSpreadBy(six, 2, 1))).toEqual(['p0', 'p1', 'p2', 'p5', 'p3', 'p4']);
    expect(ids(moveSpreadBy(six, 3, -1))).toEqual(['p0', 'p1', 'p2', 'p5', 'p3', 'p4']);
  });

  it('обложка не двигается и ничто не встаёт на её место', () => {
    expect(ids(moveSpreadBy(seven(), 0, 1))).toEqual(ids(seven()));
    expect(ids(moveSpreadBy(seven(), 1, -1))).toEqual(ids(seven()));
  });

  it('за краем книги и несуществующий разворот ничего не меняют', () => {
    expect(ids(moveSpreadBy(seven(), 3, 1))).toEqual(ids(seven()));
    expect(ids(moveSpreadBy(seven(), 9, -1))).toEqual(ids(seven()));
  });

  it('не меняет исходный макет и сохраняет тему', () => {
    const input = { ...seven(), themeId: 'film' };
    const next = moveSpreadBy(input, 1, 1);
    expect(ids(input)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
    expect(next.themeId).toBe('film');
  });
});

describe('setFit / clearPhoto', () => {
  const ref = { pageIndex: 0, cellIndex: 0 };

  it('setFit cover запоминает режим и оставляет кадр', () => {
    const input = setCrop(layoutWith(['a']), ref, { x: 0.1, y: 0, scale: 2, rotation: 0 });
    const next = setFit(input, ref, 'cover');
    expect(next.pages[0]?.cells[0]?.fit).toBe('cover');
    expect(next.pages[0]?.cells[0]?.crop).toEqual({ x: 0.1, y: 0, scale: 2, rotation: 0 });
    expect(input.pages[0]?.cells[0]?.fit).toBeUndefined();
  });

  it('setFit contain сбрасывает сдвиг и масштаб: фото вписано целиком', () => {
    const input = setFit(setCrop(layoutWith(['a']), ref, { x: 0.1, y: 0.1, scale: 2, rotation: 90 }), ref, 'cover');
    const next = setFit(input, ref, 'contain');
    expect(next.pages[0]?.cells[0]?.fit).toBe('contain');
    expect(next.pages[0]?.cells[0]?.crop).toEqual({ x: 0, y: 0, scale: 1, rotation: 90 });
  });

  it('setFit с несуществующей ячейкой ничего не меняет', () => {
    const input = layoutWith(['a']);
    expect(setFit(input, { pageIndex: 3, cellIndex: 0 }, 'cover')).toEqual(input);
  });

  it('clearPhoto убирает фото и сбрасывает кадр, остальные ячейки целы', () => {
    const input = setCrop(layoutWith(['a', 'b']), ref, { x: 0.2, y: 0, scale: 3, rotation: 0 });
    const next = clearPhoto(input, ref);
    expect(next.pages[0]?.cells[0]).toMatchObject({ photoId: null, crop: { x: 0, y: 0, scale: 1, rotation: 0 } });
    expect(next.pages[1]?.cells[0]?.photoId).toBe('b');
    expect(input.pages[0]?.cells[0]?.photoId).toBe('a');
  });
});

describe('insertPage / removePage', () => {
  it('insertPage вставляет пустую страницу one на нужное место', () => {
    const input = layoutWith(['a', 'b']);
    const next = insertPage(input, 1);
    expect(next.pages).toHaveLength(3);
    expect(next.pages[1]).toEqual({ template: 'one', cells: [{ photoId: null, crop: { x: 0, y: 0, scale: 1, rotation: 0 } }] });
    expect(next.pages[2]?.cells[0]?.photoId).toBe('b');
    expect(input.pages).toHaveLength(2);
  });

  it('insertPage с индексом за краем добавляет в конец', () => {
    expect(insertPage(layoutWith(['a']), 99).pages).toHaveLength(2);
  });

  it('removePage убирает страницу', () => {
    const next = removePage(layoutWith(['a', 'b', 'c']), 0);
    expect(next.pages.map((p) => p.cells[0]?.photoId)).toEqual(['b', 'c']);
  });

  it('removePage с индексом вне диапазона ничего не меняет', () => {
    const input = layoutWith(['a', 'b']);
    expect(removePage(input, 5)).toEqual(input);
    expect(removePage(input, -1)).toEqual(input);
  });

  it('removePage не оставляет книгу без страниц', () => {
    const input = layoutWith(['a']);
    expect(removePage(input, 0)).toEqual(input);
  });

  it('тема сохраняется при вставке и удалении', () => {
    const themed = { ...layoutWith(['a', 'b']), themeId: 'film' };
    expect(insertPage(themed, 0).themeId).toBe('film');
    expect(removePage(themed, 0).themeId).toBe('film');
  });
});

describe('setTheme', () => {
  it('ставит тему и не трогает страницы и исходный макет', () => {
    const input = layoutWith(['a', 'b']);
    const next = setTheme(input, 'film');
    expect(next.themeId).toBe('film');
    expect(next.pages).toEqual(input.pages);
    expect(input.themeId).toBeUndefined();
  });

  it('меняет тему повторно', () => {
    expect(setTheme(setTheme(layoutWith(['a']), 'film'), 'travel').themeId).toBe('travel');
  });
});

describe('editorActions', () => {
  it('swapCells меняет фото местами и не трогает остальное', () => {
    const input = layoutWith(['a', 'b', 'c']);
    const next = swapCells(input, { pageIndex: 0, cellIndex: 0 }, { pageIndex: 1, cellIndex: 0 });
    expect(next.pages[0]?.cells[0]?.photoId).toBe('b');
    expect(next.pages[1]?.cells[0]?.photoId).toBe('a');
    expect(next.pages[2]?.cells[0]?.photoId).toBe('c');
    expect(input.pages[0]?.cells[0]?.photoId).toBe('a');
  });

  it('moveSpread переставляет и сохраняет все фото', () => {
    const input = layoutWith(['a', 'b', 'c']);
    const next = moveSpread(input, 0, 2);
    expect(next.pages.map((p) => p.cells[0]?.photoId)).toEqual(['b', 'c', 'a']);
  });

  it("applyTemplate('four') сохраняет фото и добавляет пустые ячейки", () => {
    const input = layoutWith(['a']);
    const next = applyTemplate(input, 0, 'four');
    expect(next.pages[0]?.template).toBe('four');
    expect(next.pages[0]?.cells).toHaveLength(4);
    expect(next.pages[0]?.cells[0]?.photoId).toBe('a');
    expect(next.pages[0]?.cells[1]?.photoId).toBeNull();
  });

  it('setCrop с scale < 1 приводит значение к 1', () => {
    const input = layoutWith(['a']);
    const next = setCrop(input, { pageIndex: 0, cellIndex: 0 }, { x: 0, y: 0, scale: 0.5, rotation: 0 });
    expect(next.pages[0]?.cells[0]?.crop.scale).toBe(1);
  });

  it('replacePhoto заменяет photoId', () => {
    const input = layoutWith(['a']);
    const next = replacePhoto(input, { pageIndex: 0, cellIndex: 0 }, 'b');
    expect(next.pages[0]?.cells[0]?.photoId).toBe('b');
  });
});
