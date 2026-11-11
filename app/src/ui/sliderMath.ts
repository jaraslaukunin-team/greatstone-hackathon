const STEP = 0.05;

/** Положение ползунка как доля ширины 0..1; пока ширина не измерена — середина. */
export function clampSplit(x: number, width: number): number {
  if (width <= 0) return 0.5;
  return Math.min(1, Math.max(0, x / width));
}

/** Сдвиг ползунка клавишей: шаг 5% в сторону dir. */
export function stepSplit(split: number, dir: 1 | -1): number {
  return Math.min(1, Math.max(0, Math.round((split + dir * STEP) * 1000) / 1000));
}
