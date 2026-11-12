import { themeById, type BookTheme } from '@picpac/shared';
import { cellRects } from './cellRects';

const theme: BookTheme = { ...themeById('minimal'), marginPct: 0.05, gapPct: 0.02 };

describe('cellRects', () => {
  it('two: две ячейки одной ширины, поле 10, зазор 4, правый край 190 на странице 200', () => {
    const [a, b] = cellRects('two', 200, 200, 2, theme);
    expect(a!.x).toBe(10);
    expect(a!.width).toBe(88);
    expect(b!.x).toBe(102);
    expect(b!.x + b!.width).toBe(190);
    expect(a!.y).toBe(10);
    expect(a!.height).toBe(180);
  });

  it('four: сетка 2×2 с теми же отступами', () => {
    const r = cellRects('four', 200, 200, 4, theme);
    expect(r).toHaveLength(4);
    expect(r[0]).toEqual({ x: 10, y: 10, width: 88, height: 88 });
    expect(r[3]).toEqual({ x: 102, y: 102, width: 88, height: 88 });
  });

  it('one без ячеек: одна ячейка с отступом 10', () => {
    expect(cellRects('one', 200, 200, 0, theme)).toEqual([{ x: 10, y: 10, width: 180, height: 180 }]);
  });

  it('three: одно высокое фото слева и два справа друг над другом', () => {
    const r = cellRects('three', 200, 200, 3, theme);
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ x: 10, y: 10, width: 88, height: 180 });
    expect(r[1]).toEqual({ x: 102, y: 10, width: 88, height: 88 });
    expect(r[2]).toEqual({ x: 102, y: 102, width: 88, height: 88 });
  });

  it('spread-one: фото во всю страницу без полей', () => {
    expect(cellRects('spread-one', 200, 160, 1, theme)).toEqual([{ x: 0, y: 0, width: 200, height: 160 }]);
  });

  it('three при недостатке ячеек рисуется одной', () => {
    expect(cellRects('three', 200, 200, 2, theme)).toHaveLength(1);
  });

  it('если ячеек меньше, чем нужно шаблону, рисуется одна', () => {
    expect(cellRects('four', 200, 200, 2, theme)).toHaveLength(1);
  });

  it('minimal на странице 200 даёт прежние 4 px поля и зазора', () => {
    const [a, b] = cellRects('two', 200, 200, 2, themeById('minimal'));
    expect(a!.x).toBe(4);
    expect(b!.x - (a!.x + a!.width)).toBe(4);
  });
});
