import type { Adjust, FilterId } from './editState';

/**
 * Цветовая матрица 4×5 в том виде, как её принимает Skia ColorMatrix: по строке на R, G, B, A,
 * в строке 4 множителя каналов и смещение (всё в долях 0..1). Чистые числа, без Skia.
 */
export type ColorMatrix = number[];

export const IDENTITY_MATRIX: ColorMatrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];

const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;

const clamp100 = (v: number) => Math.min(100, Math.max(-100, v));
// -0 из умножений ломал бы сравнения и Object.is, поэтому приводим к 0.
const clean = (m: number[]) => m.map((v) => (v === 0 ? 0 : v));

/** Применить матрицу к цвету [r, g, b, a] (0..1); без ограничения результата, его режет рисовальщик. */
export function applyColorMatrix(m: ColorMatrix, rgba: [number, number, number, number]): [number, number, number, number] {
  const [r, g, b, a] = rgba;
  const row = (i: number) => m[i * 5]! * r + m[i * 5 + 1]! * g + m[i * 5 + 2]! * b + m[i * 5 + 3]! * a + m[i * 5 + 4]!;
  return [row(0), row(1), row(2), row(3)];
}

/** Сначала применяется first, затем second. */
export function concatMatrix(first: ColorMatrix, second: ColorMatrix): ColorMatrix {
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 5; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += second[i * 5 + k]! * first[k * 5 + j]!;
      if (j === 4) sum += second[i * 5 + 4]!;
      out.push(sum);
    }
  }
  return clean(out);
}

function saturationMatrix(s: number): ColorMatrix {
  const i = 1 - s;
  return clean([
    LR * i + s, LG * i, LB * i, 0, 0,
    LR * i, LG * i + s, LB * i, 0, 0,
    LR * i, LG * i, LB * i + s, 0, 0,
    0, 0, 0, 1, 0,
  ]);
}

function contrastMatrix(k: number): ColorMatrix {
  const o = 0.5 * (1 - k);
  return clean([k, 0, 0, 0, o, 0, k, 0, 0, o, 0, 0, k, 0, o, 0, 0, 0, 1, 0]);
}

function offsetMatrix(r: number, g: number, b: number): ColorMatrix {
  return clean([1, 0, 0, 0, r, 0, 1, 0, 0, g, 0, 0, 1, 0, b, 0, 0, 0, 1, 0]);
}

function scaleMatrix(r: number, g: number, b: number): ColorMatrix {
  return clean([r, 0, 0, 0, 0, 0, g, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0]);
}

/** Ручные настройки (каждая −100..100) в одну матрицу: насыщенность, контраст, яркость, тепло. */
export function adjustMatrix(adjust: Adjust): ColorMatrix {
  const sat = clamp100(adjust.saturation) / 100;
  const con = clamp100(adjust.contrast) / 100;
  const bri = clamp100(adjust.brightness) / 100;
  const warm = clamp100(adjust.warmth) / 100;
  let m = saturationMatrix(1 + sat);
  m = concatMatrix(m, contrastMatrix(1 + con));
  m = concatMatrix(m, offsetMatrix(bri * 0.4, bri * 0.4, bri * 0.4));
  m = concatMatrix(m, offsetMatrix(warm * 0.08, 0, -warm * 0.08));
  return m;
}

export function filterMatrix(id: FilterId): ColorMatrix {
  switch (id) {
    case 'original':
      return [...IDENTITY_MATRIX];
    case 'bw':
      return saturationMatrix(0);
    case 'sepia':
      return clean([0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0]);
    case 'warm':
      return concatMatrix(scaleMatrix(1.08, 1, 0.9), offsetMatrix(0.02, 0, -0.02));
    case 'cool':
      return concatMatrix(scaleMatrix(0.92, 1, 1.08), offsetMatrix(-0.02, 0, 0.03));
    case 'vintage':
      return concatMatrix(concatMatrix(saturationMatrix(0.7), scaleMatrix(0.95, 0.92, 0.8)), offsetMatrix(0.05, 0.03, 0.02));
    case 'vivid':
      return concatMatrix(saturationMatrix(1.5), contrastMatrix(1.1));
    case 'soft':
      return concatMatrix(contrastMatrix(0.85), offsetMatrix(0.04, 0.04, 0.04));
  }
}
