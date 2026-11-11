import { nextIndex, spreadsOf } from './flip';

describe('spreadsOf', () => {
  it('пустая книга — один пустой разворот', () => {
    expect(spreadsOf(0)).toEqual([[null, null]]);
  });
  it('обложка справа, дальше пары страниц', () => {
    expect(spreadsOf(3)).toEqual([
      [null, 0],
      [1, 2],
    ]);
  });
  it('нечётное число страниц оставляет последнюю одну', () => {
    expect(spreadsOf(4)).toEqual([
      [null, 0],
      [1, 2],
      [3, null],
    ]);
  });
  it('все страницы присутствуют ровно один раз', () => {
    for (const n of [1, 2, 7, 20]) {
      const seen = spreadsOf(n).flat().filter((x): x is number => x !== null);
      expect(seen).toEqual(Array.from({ length: n }, (_, i) => i));
    }
  });
});

describe('nextIndex', () => {
  it('двигает на шаг в нужную сторону', () => {
    expect(nextIndex(1, 3, 1)).toBe(2);
    expect(nextIndex(1, 3, -1)).toBe(0);
  });
  it('на краях остаётся на месте', () => {
    expect(nextIndex(0, 3, -1)).toBe(0);
    expect(nextIndex(2, 3, 1)).toBe(2);
    expect(nextIndex(0, 0, 1)).toBe(0);
  });
});
