/** Тип бумаги для печати фотографий. */
export type Paper = 'glossy' | 'matte';

const GLOSSY = /глянц|glossy/i;
const MATTE = /матт?|matte/i;

/**
 * Определяет тип бумаги по названию варианта формата.
 * Возвращает null, если тип бумаги не указан в строке.
 */
export function paperOf(format: string): Paper | null {
  if (GLOSSY.test(format)) return 'glossy';
  if (MATTE.test(format)) return 'matte';
  return null;
}

export const paperLabel: Record<Paper, string> = {
  glossy: 'Глянец',
  matte: 'Мат',
};
