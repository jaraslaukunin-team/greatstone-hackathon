import { exportSize, FULL_CROP, rotateCropQuarter, toFrameFractions } from './geometry';

describe('exportSize', () => {
  it('большое фото 6000×4000 ужимается до 4096 по длинной стороне с теми же пропорциями', () => {
    expect(exportSize(6000, 4000, FULL_CROP, 0)).toEqual({ width: 4096, height: 2731 });
  });

  it('поворот на 90° и 270° меняет стороны местами', () => {
    expect(exportSize(6000, 4000, FULL_CROP, 90)).toEqual({ width: 2731, height: 4096 });
    expect(exportSize(6000, 4000, FULL_CROP, 270)).toEqual({ width: 2731, height: 4096 });
    expect(exportSize(6000, 4000, FULL_CROP, 180)).toEqual({ width: 4096, height: 2731 });
  });

  it('кадр уменьшает результат: половина ширины даёт 3000×4000', () => {
    expect(exportSize(6000, 4000, { x: 0, y: 0, w: 0.5, h: 1 }, 0)).toEqual({ width: 3000, height: 4000 });
  });

  it('маленькое фото не растягивается', () => {
    expect(exportSize(800, 600, FULL_CROP, 0)).toEqual({ width: 800, height: 600 });
  });

  it('можно задать другой предел', () => {
    expect(exportSize(6000, 4000, FULL_CROP, 0, 1000)).toEqual({ width: 1000, height: 667 });
  });

  it('вырожденный кадр не даёт нулевой размер', () => {
    const size = exportSize(1000, 1000, { x: 0, y: 0, w: 0, h: 0 }, 0);
    expect(size.width).toBeGreaterThanOrEqual(1);
    expect(size.height).toBeGreaterThanOrEqual(1);
  });
});

describe('rotateCropQuarter', () => {
  it('поворачивает рамку на 90° по часовой внутри единичного квадрата', () => {
    expect(rotateCropQuarter({ x: 0, y: 0, w: 0.5, h: 1 })).toEqual({ x: 0, y: 0, w: 1, h: 0.5 });
    expect(rotateCropQuarter({ x: 0.2, y: 0.1, w: 0.3, h: 0.4 })).toEqual({ x: 0.5, y: 0.2, w: 0.4, h: 0.3 });
  });

  it('четыре поворота возвращают исходную рамку', () => {
    const start = { x: 0.1, y: 0.25, w: 0.5, h: 0.4 };
    let c = start;
    for (let i = 0; i < 4; i++) c = rotateCropQuarter(c);
    expect(c.x).toBeCloseTo(start.x, 9);
    expect(c.y).toBeCloseTo(start.y, 9);
    expect(c.w).toBeCloseTo(start.w, 9);
    expect(c.h).toBeCloseTo(start.h, 9);
  });
});

describe('toFrameFractions', () => {
  it('переводит точку на экране в доли кадра', () => {
    expect(toFrameFractions(50, 25, 100, 50)).toEqual([0.5, 0.5]);
  });

  it('точка за краем прижимается к границе', () => {
    expect(toFrameFractions(-10, 999, 100, 50)).toEqual([0, 1]);
  });

  it('нулевой размер кадра не даёт деления на ноль', () => {
    expect(toFrameFractions(5, 5, 0, 0)).toEqual([0, 0]);
  });
});
