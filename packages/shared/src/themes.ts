/**
 * Темы оформления книги. Цвета повторяют палитру брендбука (app/src/theme/theme.ts),
 * но продублированы здесь: shared не может импортировать код приложения.
 */

export type ThemeId = 'minimal' | 'film' | 'travel' | 'holiday' | 'graduation';

export type BookTheme = {
  id: ThemeId;
  title: string;
  /** То же, что title: имя темы для витрины и карусели. */
  name: string;
  /** Цвет листа. */
  pageBg: string;
  /** Поле страницы, доля ширины (0..0.12). */
  marginPct: number;
  /** Зазор между фото, доля ширины (0..0.12). */
  gapPct: number;
  frame: 'none' | 'thin' | 'polaroid';
  frameColor: string;
  cover: 'full-photo' | 'framed-photo' | 'color-title';
  coverBg: string;
  titleFont: 'demi' | 'light' | 'book';
  titleColor: string;
  /** Цвет надписей на обложке (то же, что titleColor): так называют его экраны витрины. */
  coverText: string;
  /** Цвет подписей на страницах: подобран под лист темы, чтобы текст читался. */
  textColor: string;
  /** Цвет корешка и рамок на витрине. */
  spine: string;
  /** Акцентный цвет темы: кнопки и метки на витрине. */
  accent: string;
};

export const THEMES: readonly BookTheme[] = [
  {
    id: 'minimal',
    title: 'Минимализм',
    name: 'Минимализм',
    pageBg: '#FFFFFF',
    marginPct: 0.02,
    gapPct: 0.02,
    frame: 'none',
    frameColor: '#FFFFFF',
    cover: 'full-photo',
    coverBg: '#364C49',
    titleFont: 'demi',
    titleColor: '#FFFFFF',
    coverText: '#FFFFFF',
    textColor: '#364C49',
    spine: '#CCC7BF',
    accent: '#364C49',
  },
  {
    id: 'film',
    title: 'Тёплая плёнка',
    name: 'Тёплая плёнка',
    pageBg: '#F6EFE6',
    marginPct: 0.06,
    gapPct: 0.04,
    frame: 'polaroid',
    frameColor: '#FFFFFF',
    cover: 'framed-photo',
    coverBg: '#EDE1D5',
    titleFont: 'light',
    titleColor: '#364C49',
    coverText: '#364C49',
    textColor: '#5A4636',
    spine: '#C9B9A6',
    accent: '#DD5757',
  },
  {
    id: 'travel',
    title: 'Путешествие',
    name: 'Путешествие',
    pageBg: '#CFDDE7',
    marginPct: 0.05,
    gapPct: 0.03,
    frame: 'thin',
    frameColor: '#FFFFFF',
    cover: 'full-photo',
    coverBg: '#33454F',
    titleFont: 'demi',
    titleColor: '#FFFFFF',
    coverText: '#FFFFFF',
    textColor: '#25414F',
    spine: '#A8C0CE',
    accent: '#4A7A96',
  },
  {
    id: 'holiday',
    title: 'Праздник',
    name: 'Праздник',
    pageBg: '#EDD5D5',
    marginPct: 0.06,
    gapPct: 0.03,
    frame: 'thin',
    frameColor: '#DD5757',
    cover: 'color-title',
    coverBg: '#DD5757',
    titleFont: 'demi',
    titleColor: '#FFFFFF',
    coverText: '#FFFFFF',
    textColor: '#8A2F2F',
    spine: '#D4A5A5',
    accent: '#DD5757',
  },
  {
    id: 'graduation',
    title: 'Выпускной',
    name: 'Выпускной',
    pageBg: '#E0DCE8',
    marginPct: 0.05,
    gapPct: 0.03,
    frame: 'thin',
    frameColor: '#364C49',
    cover: 'color-title',
    coverBg: '#364C49',
    titleFont: 'book',
    titleColor: '#F6EFE6',
    coverText: '#F6EFE6',
    textColor: '#2F2A45',
    spine: '#B8B0CC',
    accent: '#7B6FA0',
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'minimal';

/** Тема по id; неизвестный или пустой id (старый макет) даёт тему по умолчанию. */
export function themeById(id: string | undefined): BookTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}
