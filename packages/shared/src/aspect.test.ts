import { describe, expect, it } from 'vitest';
import { ASPECT_RATIOS, aspectValue, fitRect } from './aspect';
import { aiEditRequestSchema, cellSchema } from './schemas';

describe('fitRect', () => {
  it('contain: вертикальное фото в кадре 16:9 вписано целиком, поля по бокам', () => {
    expect(fitRect({ width: 300, height: 400 }, { width: 1600, height: 900 }, 'contain')).toEqual({
      x: 462.5,
      y: 0,
      width: 675,
      height: 900,
    });
  });

  it('cover: то же фото заполняет кадр, лишнее уходит за верх и низ', () => {
    const r = fitRect({ width: 300, height: 400 }, { width: 1600, height: 900 }, 'cover');
    expect(r.x).toBe(0);
    expect(r.width).toBe(1600);
    expect(r.height).toBeCloseTo(2133.333, 2);
    expect(r.y).toBeCloseTo(-616.667, 2);
  });

  it('пропорции фото сохраняются в обоих режимах (без растяжения)', () => {
    for (const mode of ['contain', 'cover'] as const) {
      const r = fitRect({ width: 4000, height: 3000 }, { width: 500, height: 700 }, mode);
      expect(r.width / r.height).toBeCloseTo(4 / 3, 6);
    }
  });

  it('квадрат в квадрате занимает весь кадр', () => {
    expect(fitRect({ width: 10, height: 10 }, { width: 200, height: 200 }, 'contain')).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
  });
});

describe('aspectValue', () => {
  it('считает ширину к высоте', () => {
    expect(aspectValue('16:9')).toBeCloseTo(1.7778, 4);
    expect(aspectValue('5:7')).toBeCloseTo(5 / 7, 6);
  });
  it('original берёт пропорцию фото, без фото 1', () => {
    expect(aspectValue('original', { width: 2, height: 1 })).toBe(2);
    expect(aspectValue('original')).toBe(1);
  });
  it('список пропорций как в спецификации', () => {
    expect(ASPECT_RATIOS).toEqual(['original', '1:1', '4:3', '3:2', '16:9', '5:7']);
  });
});

describe('схемы', () => {
  it('ячейка без fit остаётся валидной, fit принимает contain и cover', () => {
    expect(cellSchema.parse({ photoId: null, crop: { x: 0, y: 0, scale: 1, rotation: 0 } })).toBeTruthy();
    expect(cellSchema.parse({ photoId: 'a', crop: { x: 0, y: 0, scale: 1, rotation: 0 }, fit: 'cover' }).fit).toBe(
      'cover',
    );
    expect(() => cellSchema.parse({ photoId: 'a', crop: { x: 0, y: 0, scale: 1, rotation: 0 }, fit: 'stretch' })).toThrow();
  });
  it('aiEditRequest принимает aspect из списка и отклоняет чужой', () => {
    const base = { projectId: 'p', photoId: 'f', prompt: 'ретро' };
    expect(aiEditRequestSchema.parse({ ...base, aspect: '16:9' }).aspect).toBe('16:9');
    expect(() => aiEditRequestSchema.parse({ ...base, aspect: '2:1' })).toThrow();
  });
});
