import { adjustMatrix, applyColorMatrix, concatMatrix, filterMatrix, IDENTITY_MATRIX } from './colorMatrix';

const zero = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };
const FILTERS = ['original', 'bw', 'sepia', 'warm', 'cool', 'vintage', 'vivid', 'soft'] as const;

function expectClose(actual: number[], expected: number[]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i]!, 6));
}

describe('colorMatrix', () => {
  it('нулевые настройки и фильтр «оригинал» дают единичную матрицу', () => {
    expectClose(adjustMatrix(zero), IDENTITY_MATRIX);
    expectClose(filterMatrix('original'), IDENTITY_MATRIX);
  });

  it('у каждого фильтра матрица из 20 чисел и непрозрачность не меняется', () => {
    for (const id of FILTERS) {
      const m = filterMatrix(id);
      expect(m).toHaveLength(20);
      expectClose(m.slice(15, 20), [0, 0, 0, 1, 0]);
    }
  });

  it('чёрно-белый фильтр даёт одинаковые строки для R, G и B', () => {
    const m = filterMatrix('bw');
    expectClose(m.slice(0, 5), m.slice(5, 10));
    expectClose(m.slice(5, 10), m.slice(10, 15));
  });

  it('concatMatrix: единичная матрица ничего не меняет с любой стороны', () => {
    const m = filterMatrix('sepia');
    expectClose(concatMatrix(IDENTITY_MATRIX, m), m);
    expectClose(concatMatrix(m, IDENTITY_MATRIX), m);
  });

  it('concatMatrix применяет сначала первую матрицу, затем вторую', () => {
    const addRed = [...IDENTITY_MATRIX];
    addRed[4] = 0.1; // R + 0.1
    const doubleRed = [...IDENTITY_MATRIX];
    doubleRed[0] = 2; // R * 2
    const result = concatMatrix(addRed, doubleRed);
    expect(result[0]).toBeCloseTo(2, 6);
    expect(result[4]).toBeCloseTo(0.2, 6); // (R + 0.1) * 2
    expectClose(applyColorMatrix(result, [0.25, 0.5, 0.5, 1]), [0.7, 0.5, 0.5, 1]);
  });

  it('яркость +100 делает светлее, −100 темнее', () => {
    const lighter = applyColorMatrix(adjustMatrix({ ...zero, brightness: 100 }), [0.5, 0.5, 0.5, 1]);
    const darker = applyColorMatrix(adjustMatrix({ ...zero, brightness: -100 }), [0.5, 0.5, 0.5, 1]);
    expect(lighter[0]).toBeGreaterThan(0.5);
    expect(darker[0]).toBeLessThan(0.5);
  });

  it('контраст +100 разводит светлое и тёмное, −100 сближает их', () => {
    const high = adjustMatrix({ ...zero, contrast: 100 });
    expect(applyColorMatrix(high, [0.75, 0.75, 0.75, 1])[0]).toBeGreaterThan(0.75);
    expect(applyColorMatrix(high, [0.25, 0.25, 0.25, 1])[0]).toBeLessThan(0.25);
    const low = adjustMatrix({ ...zero, contrast: -100 });
    expect(applyColorMatrix(low, [0.75, 0.75, 0.75, 1])[0]).toBeCloseTo(0.5, 6);
  });

  it('насыщенность −100 даёт серый, цвет серого не меняется', () => {
    const gray = adjustMatrix({ ...zero, saturation: -100 });
    const [r, g, b] = applyColorMatrix(gray, [0.9, 0.2, 0.1, 1]);
    expect(r).toBeCloseTo(g!, 6);
    expect(g).toBeCloseTo(b!, 6);
    expectClose(applyColorMatrix(gray, [0.4, 0.4, 0.4, 1]), [0.4, 0.4, 0.4, 1]);
  });

  it('тепло +100 добавляет красного и убирает синего, −100 наоборот', () => {
    const warm = applyColorMatrix(adjustMatrix({ ...zero, warmth: 100 }), [0.5, 0.5, 0.5, 1]);
    expect(warm[0]).toBeGreaterThan(0.5);
    expect(warm[2]).toBeLessThan(0.5);
    const cold = applyColorMatrix(adjustMatrix({ ...zero, warmth: -100 }), [0.5, 0.5, 0.5, 1]);
    expect(cold[0]).toBeLessThan(0.5);
    expect(cold[2]).toBeGreaterThan(0.5);
  });

  it('значения за пределами −100..100 ограничиваются, а не ломают матрицу', () => {
    expectClose(adjustMatrix({ ...zero, brightness: 9999 }), adjustMatrix({ ...zero, brightness: 100 }));
    expectClose(adjustMatrix({ ...zero, contrast: -9999 }), adjustMatrix({ ...zero, contrast: -100 }));
  });
});
