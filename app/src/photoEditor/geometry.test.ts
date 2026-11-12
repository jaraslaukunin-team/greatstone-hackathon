import { cropForAspect, exportSize, FULL_CROP, rotateCropQuarter, toFrameFractions } from './geometry';

describe('cropForAspect', () => {
  it('квадрат из горизонтального фото 6000×4000: вся высота, по центру', () => {
    const c = cropForAspect(6000, 4000, 1);
    expect(c.h).toBe(1);
    expect(c.w).toBeCloseTo(2 / 3, 9);
    expect(c.x).toBeCloseTo(1 / 6, 9);
    expect(c.y).toBe(0);
  });

  it('16:9 из вертикального 4000×6000: вся ширина, по центру по высоте', () => {
    const c = cropForAspect(4000, 6000, 16 / 9);
    expect(c.w).toBe(1);
    expect(c.h).toBeCloseTo(0.375, 9);
    expect(c.y).toBeCloseTo(0.3125, 9);
    expect(c.x).toBe(0);
  });

  it('пропорции фото дают целый кадр', () => {
    const c = cropForAspect(6000, 4000, 3 / 2);
    expect(c.x).toBeCloseTo(0, 9);
    expect(c.y).toBeCloseTo(0, 9);
    expect(c.w).toBeCloseTo(1, 9);
    expect(c.h).toBeCloseTo(1, 9);
  });

  it('сдвиг двигает рамку вдоль свободной оси и не выпускает её за фото', () => {
    expect(cropForAspect(6000, 4000, 1, 0).x).toBe(0);
    expect(cropForAspect(6000, 4000, 1, 1).x).toBeCloseTo(1 - 2 / 3, 9);
    expect(cropForAspect(6000, 4000, 1, 7).x).toBeCloseTo(1 - 2 / 3, 9);
    expect(cropForAspect(6000, 4000, 1, -3).x).toBe(0);
  });

  it('нулевой размер фото не ломает расчёт', () => {
    expect(cropForAspect(0, 0, 1)).toEqual(FULL_CROP);
  });
});

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
