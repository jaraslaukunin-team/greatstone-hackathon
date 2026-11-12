import { bleedRect, foldBandWidth } from './safeZones';

describe('safeZones', () => {
  it('зона обреза 3 мм на странице 20 см и 200 px — отступ 3 px', () => {
    expect(bleedRect(200, 200, 20)).toEqual({ x: 3, y: 3, width: 194, height: 194 });
  });

  it('отступ растёт вместе с толщиной обреза и пропорционален странице', () => {
    expect(bleedRect(400, 300, 20, 5)).toEqual({ x: 10, y: 10, width: 380, height: 280 });
  });

  it('на очень узкой странице зона не уходит в минус', () => {
    const r = bleedRect(4, 4, 1, 3);
    expect(r.width).toBeGreaterThanOrEqual(0);
    expect(r.height).toBeGreaterThanOrEqual(0);
  });

  it('полоса сгиба 10 мм на странице 20 см и 200 px — 10 px со стороны корешка', () => {
    expect(foldBandWidth(200, 20)).toBe(10);
    expect(foldBandWidth(200, 20, 20)).toBe(20);
  });

  it('нулевая ширина страницы в сантиметрах не даёт деления на ноль', () => {
    expect(foldBandWidth(200, 0)).toBe(0);
    expect(bleedRect(200, 200, 0)).toEqual({ x: 0, y: 0, width: 200, height: 200 });
  });
});
