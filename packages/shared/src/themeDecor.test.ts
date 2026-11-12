import { describe, expect, it } from 'vitest';
import { THEMES, themeById } from './themes';
import { decorShapes, type DecorShape } from './themeDecor';

const W = 300;
const H = 300;

function bounds(s: DecorShape): [number, number, number, number] {
  if (s.kind === 'circle') return [s.cx - s.r, s.cy - s.r, s.cx + s.r, s.cy + s.r];
  if (s.kind === 'line') return [Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.max(s.x1, s.x2), Math.max(s.y1, s.y2)];
  return [s.x, s.y, s.x + s.w, s.y + s.h];
}

describe('decorShapes', () => {
  it('у темы без украшений нет фигур', () => {
    expect(decorShapes('none', W, H)).toEqual([]);
    expect(themeById('minimal').decor).toBe('none');
  });

  it('у остальных тем есть украшения, и все разные', () => {
    const decorated = THEMES.filter((t) => t.decor !== 'none');
    expect(decorated.length).toBe(THEMES.length - 1);
    expect(new Set(decorated.map((t) => t.decor)).size).toBe(decorated.length);
    for (const t of decorated) expect(decorShapes(t.decor, W, H).length, t.id).toBeGreaterThan(0);
  });

  it('все фигуры лежат внутри листа', () => {
    for (const t of THEMES) {
      for (const s of decorShapes(t.decor, W, H)) {
        const [x0, y0, x1, y1] = bounds(s);
        expect(x0, `${t.id} ${s.kind}`).toBeGreaterThanOrEqual(-0.001);
        expect(y0, `${t.id} ${s.kind}`).toBeGreaterThanOrEqual(-0.001);
        expect(x1, `${t.id} ${s.kind}`).toBeLessThanOrEqual(W + 0.001);
        expect(y1, `${t.id} ${s.kind}`).toBeLessThanOrEqual(H + 0.001);
      }
    }
  });

  it('украшения не заходят в рабочую область страницы: по краям, в пределах поля темы', () => {
    for (const t of THEMES) {
      const margin = t.marginPct * W;
      for (const s of decorShapes(t.decor, W, H)) {
        const [x0, y0, x1, y1] = bounds(s);
        if (s.kind === 'frame') continue; // рамка идёт по периметру тонкой линией
        const inBandX = x1 <= margin + 0.5 || x0 >= W - margin - 0.5;
        const inBandY = y1 <= margin + 0.5 || y0 >= H - margin - 0.5;
        expect(inBandX || inBandY, `${t.id} ${s.kind} [${x0.toFixed(0)},${y0.toFixed(0)}]`).toBe(true);
      }
    }
  });

  it('прозрачность в допустимых пределах, расчёт повторяем', () => {
    for (const t of THEMES) {
      const a = decorShapes(t.decor, W, H);
      expect(decorShapes(t.decor, W, H)).toEqual(a);
      for (const s of a) {
        expect(s.opacity).toBeGreaterThan(0);
        expect(s.opacity).toBeLessThanOrEqual(1);
      }
    }
  });

  it('у каждой темы есть шрифт подписей и цвет украшений', () => {
    for (const t of THEMES) {
      expect(['light', 'book', 'medium', 'demi']).toContain(t.captionFont);
      expect(t.decorColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('лист без размера (ещё не измерен) даёт пустой список и не зацикливается', () => {
    for (const t of THEMES) {
      expect(decorShapes(t.decor, 0, 0), t.id).toEqual([]);
      expect(decorShapes(t.decor, 0, 300), t.id).toEqual([]);
      expect(decorShapes(t.decor, 300, 0), t.id).toEqual([]);
      expect(decorShapes(t.decor, Number.NaN, 300), t.id).toEqual([]);
      expect(decorShapes(t.decor, Number.POSITIVE_INFINITY, 300), t.id).toEqual([]);
      expect(decorShapes(t.decor, 5, 5), t.id).toEqual([]);
    }
  });

  it('число фигур плёнки ограничено даже на очень большом листе', () => {
    expect(decorShapes('filmstrip', 2000, 2000).length).toBeLessThan(400);
  });
});
