import { billablePages } from './billablePages';

const cell = { photoId: 'a', crop: { x: 0, y: 0, scale: 1, rotation: 0 as const } };

describe('billablePages', () => {
  it('у книги это число страниц', () => {
    expect(billablePages({ pages: [{ template: 'one', cells: [cell] }, { template: 'one', cells: [cell] }] })).toBe(2);
  });
  it('у печати это сумма копий', () => {
    expect(
      billablePages({ pages: [{ template: 'one', copies: 3, cells: [cell] }, { template: 'one', copies: 2, cells: [cell] }] }),
    ).toBe(5);
  });
  it('пустой макет считается как одна страница', () => {
    expect(billablePages({ pages: [] })).toBe(1);
  });
});
