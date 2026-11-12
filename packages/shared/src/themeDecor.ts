/**
 * Украшения страниц в темах оформления: перфорация плёнки, пунктир маршрута, конфетти, золотая рамка.
 * Чистая геометрия без отрисовки: приложение рисует фигуры в SVG. Всё лежит в полях листа (до 5% стороны),
 * поэтому фото на странице украшения не перекрывают.
 */

export type DecorId = 'none' | 'filmstrip' | 'route' | 'confetti' | 'ribbon';

export type DecorShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number; opacity: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; opacity: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; dash?: [number, number]; opacity: number }
  | { kind: 'frame'; x: number; y: number; w: number; h: number; width: number; opacity: number };

/** Толщина полосы с украшениями по краю, доля стороны листа. Не больше поля самой тонкой украшенной темы. */
export const DECOR_BAND = 0.05;

function filmstrip(w: number, h: number): DecorShape[] {
  const band = DECOR_BAND * w;
  const rw = band * 0.5;
  const rh = band * 0.75;
  const step = rh * 2;
  if (step <= 0) return [];
  const out: DecorShape[] = [];
  for (let y = step / 2; y + rh <= h - step / 4; y += step) {
    out.push({ kind: 'rect', x: (band - rw) / 2, y, w: rw, h: rh, r: rw * 0.25, opacity: 0.6 });
    out.push({ kind: 'rect', x: w - band + (band - rw) / 2, y, w: rw, h: rh, r: rw * 0.25, opacity: 0.6 });
  }
  return out;
}

function route(w: number, h: number): DecorShape[] {
  const band = DECOR_BAND * w;
  const dot = band * 0.28;
  const yTop = band / 2;
  const yBottom = h - band / 2;
  return [
    { kind: 'line', x1: band + dot * 2, y1: yTop, x2: w - band - dot * 2, y2: yTop, width: 1.5, dash: [6, 4], opacity: 0.75 },
    { kind: 'line', x1: band + dot * 2, y1: yBottom, x2: w - band - dot * 2, y2: yBottom, width: 1.5, dash: [6, 4], opacity: 0.75 },
    { kind: 'circle', cx: band, cy: yTop, r: dot, opacity: 0.85 },
    { kind: 'circle', cx: w - band, cy: yTop, r: dot, opacity: 0.85 },
    { kind: 'circle', cx: band, cy: yBottom, r: dot, opacity: 0.85 },
    { kind: 'circle', cx: w - band, cy: yBottom, r: dot, opacity: 0.85 },
  ];
}

function confetti(w: number, h: number): DecorShape[] {
  const band = DECOR_BAND * w;
  const out: DecorShape[] = [];
  const radius = (i: number) => band * (0.12 + (0.1 * ((i * 13) % 5)) / 4);
  const across = (i: number) => band * (0.3 + (0.3 * ((i * 37) % 7)) / 6);
  const horizontal = 14;
  for (let i = 0; i < horizontal; i++) {
    const x = w * (0.04 + (0.92 * i) / (horizontal - 1));
    out.push({ kind: 'circle', cx: x, cy: across(i), r: radius(i), opacity: 0.65 });
    out.push({ kind: 'circle', cx: w - x, cy: h - across(i + 3), r: radius(i + 2), opacity: 0.65 });
  }
  const vertical = 8;
  for (let i = 0; i < vertical; i++) {
    const y = h * (0.12 + (0.76 * i) / (vertical - 1));
    out.push({ kind: 'circle', cx: across(i + 5), cy: y, r: radius(i + 1), opacity: 0.65 });
    out.push({ kind: 'circle', cx: w - across(i + 1), cy: h - y, r: radius(i + 4), opacity: 0.65 });
  }
  return out;
}

function ribbon(w: number, h: number): DecorShape[] {
  const band = DECOR_BAND * w;
  const corner = band * 0.3;
  const inset = (k: number) => band * k;
  const frame = (k: number, width: number, opacity: number): DecorShape => ({
    kind: 'frame',
    x: inset(k),
    y: inset(k),
    w: w - inset(k) * 2,
    h: h - inset(k) * 2,
    width,
    opacity,
  });
  const square = (x: number, y: number): DecorShape => ({ kind: 'rect', x, y, w: corner, h: corner, r: 0, opacity: 0.9 });
  return [
    frame(0.35, 1.5, 0.85),
    frame(0.6, 0.75, 0.6),
    square(inset(0.2), inset(0.2)),
    square(w - inset(0.2) - corner, inset(0.2)),
    square(inset(0.2), h - inset(0.2) - corner),
    square(w - inset(0.2) - corner, h - inset(0.2) - corner),
  ];
}

/** Фигуры украшения для листа w×h в пикселях. Расчёт без случайности: на любом устройстве одинаковый. */
export function decorShapes(decor: DecorId, w: number, h: number): DecorShape[] {
  // Лист ещё не измерен (0), или размер не число: рисовать нечего. Для нулевого шага цикл плёнки не закончился бы никогда.
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 20 || h < 20) return [];
  switch (decor) {
    case 'filmstrip':
      return filmstrip(w, h);
    case 'route':
      return route(w, h);
    case 'confetti':
      return confetti(w, h);
    case 'ribbon':
      return ribbon(w, h);
    default:
      return [];
  }
}
