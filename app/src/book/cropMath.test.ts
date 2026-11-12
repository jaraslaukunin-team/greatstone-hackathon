import { clampCrop } from './cropMath';

const base = { x: 0, y: 0, scale: 1, rotation: 0 as const };
const square = { width: 100, height: 100 };
const landscape = { width: 4000, height: 3000 }; // 4:3

describe('clampCrop', () => {
  it('масштаб не меньше 1 и не больше 4', () => {
    expect(clampCrop(landscape, square, 'cover', { ...base, scale: 0.3 }).scale).toBe(1);
    expect(clampCrop(landscape, square, 'cover', { ...base, scale: 9 }).scale).toBe(4);
  });

  it('центр остаётся центром', () => {
    expect(clampCrop(landscape, square, 'cover', base)).toEqual(base);
  });

  it('cover: сдвиг не выводит фото за границу ячейки (4:3 в квадрате, запас по ширине 1/6)', () => {
    const r = clampCrop(landscape, square, 'cover', { ...base, x: 0.9, y: 0.9 });
    expect(r.x).toBeCloseTo(1 / 6, 5);
    expect(r.y).toBe(0);
    expect(clampCrop(landscape, square, 'cover', { ...base, x: -0.9 }).x).toBeCloseTo(-1 / 6, 5);
  });

  it('cover: с увеличением запас для сдвига растёт', () => {
    // при scale 2 фото 133,3×100 → 266,7×200: по x запас (266,7−100)/2/100, по y (200−100)/2/100
    const r = clampCrop(landscape, square, 'cover', { ...base, scale: 2, x: 5, y: 5 });
    expect(r.x).toBeCloseTo(0.8333, 3);
    expect(r.y).toBeCloseTo(0.5, 5);
  });

  it('contain: сдвиг обнуляется', () => {
    const r = clampCrop(landscape, square, 'contain', { ...base, x: 0.4, y: -0.4 });
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it('поворот не меняется', () => {
    expect(clampCrop(landscape, square, 'cover', { ...base, rotation: 90 }).rotation).toBe(90);
  });
});
