import {
  applyTemplate,
  insertPage,
  moveSpread,
  removePage,
  replacePhoto,
  setCrop,
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
