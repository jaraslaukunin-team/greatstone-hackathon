import type { PageText } from '@picpac/shared';
import { TEXT_STYLES } from './textStyles';

/** Ширина блока подписи в долях страницы. */
export const TEXT_BOX_WIDTH = 0.8;
const LINE_HEIGHT = 1.25;
/** Средняя ширина символа в долях размера шрифта: нужна только для прикидки числа строк. */
const CHAR_WIDTH = 0.5;

export type TextBoxRect = { left: number; top: number; width: number; height: number; size: number };

/** Положение и размер блока подписи в пикселях страницы: x, y — центр текста, как рисует PageView. */
export function textBox(t: Pick<PageText, 'text' | 'x' | 'y' | 'style'>, width: number, height: number): TextBoxRect {
  const style = TEXT_STYLES[t.style];
  const size = (style?.size ?? 0.05) * width;
  const boxW = width * TEXT_BOX_WIDTH;
  const maxLines = t.style === 'quote' ? 6 : 3;
  const perLine = Math.max(1, Math.floor(boxW / (size * CHAR_WIDTH)));
  const lines = Math.min(maxLines, Math.max(1, Math.ceil((t.text || ' ').length / perLine)));
  return {
    left: Math.min(width - boxW, Math.max(0, t.x * width - boxW / 2)),
    top: Math.max(0, t.y * height - size * 0.7),
    width: boxW,
    height: size * LINE_HEIGHT * lines,
    size,
  };
}

/** Центр надписи не выходит за страницу. */
export function clampTextPos(x: number, y: number): { x: number; y: number } {
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}
