import type { PageTextStyle } from '@picpac/shared';
import { fonts } from '../theme/theme';

/** Готовые стили подписей вместо полного выбора шрифтов. size — доля ширины страницы. */
export const TEXT_STYLES: Record<PageTextStyle, { label: string; font: string; size: number; sample: string }> = {
  title: { label: 'Заголовок', font: fonts.demi, size: 0.075, sample: 'Наше лето' },
  caption: { label: 'Подпись', font: fonts.book, size: 0.045, sample: 'Тот самый день' },
  date: { label: 'Дата', font: fonts.light, size: 0.04, sample: '14 июля 2026' },
  quote: { label: 'Цитата', font: fonts.medium, size: 0.052, sample: 'Лучшие моменты' },
};

export const TEXT_STYLE_IDS = Object.keys(TEXT_STYLES) as PageTextStyle[];
