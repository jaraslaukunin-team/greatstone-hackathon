import { addedCount, progressText } from './progressText';

const m = (photosCount: number) => ({ userId: String(Math.random()), childName: null, role: 'contributor' as const, photosCount });

describe('addedCount', () => {
  it('считает тех, кто добавил хотя бы одно фото, а не всех участников', () => {
    expect(addedCount([m(0), m(3), m(1), m(0)])).toBe(2);
  });
  it('пустой список — 0', () => {
    expect(addedCount([])).toBe(0);
  });
});

describe('progressText', () => {
  it('показывает «добавили фото» с ожидаемым числом', () => {
    expect(progressText({ expected: 25, members: [m(2), m(0)] })).toBe('1 из 25 добавили фото');
  });
  it('без ожидаемого числа показывает знак вопроса, без данных — многоточие', () => {
    expect(progressText({ expected: null, members: [m(1)] })).toBe('1 из ? добавили фото');
    expect(progressText(null)).toBe('…');
  });
});
