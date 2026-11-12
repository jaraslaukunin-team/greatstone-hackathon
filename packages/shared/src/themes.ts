/**
 * Book themes for PicPac photobooks.
 * Colors follow the PicPac 2025 brandbook palette.
 */

export type ThemeId = 'minimal' | 'film' | 'travel' | 'holiday' | 'graduation';

export type BookTheme = {
  id: ThemeId;
  /** Human-readable name (Russian). */
  name: string;
  /** Page / spread background color. */
  pageBg: string;
  /** Cover background color. */
  coverBg: string;
  /** Cover title text color. */
  coverText: string;
  /** Spine / binding color. */
  spine: string;
  /** Accent color (borders, decorations). */
  accent: string;
};

export const THEMES: BookTheme[] = [
  {
    id: 'minimal',
    name: 'Минимализм',
    pageBg: '#FFFFFF',
    coverBg: '#F6EFE6',
    coverText: '#364C49',
    spine: '#CCC7BF',
    accent: '#364C49',
  },
  {
    id: 'film',
    name: 'Кино',
    pageBg: '#1C1C1E',
    coverBg: '#111111',
    coverText: '#F6EFE6',
    spine: '#2C2C2E',
    accent: '#DD5757',
  },
  {
    id: 'travel',
    name: 'Путешествия',
    pageBg: '#FAFAF8',
    coverBg: '#CFDDE7',
    coverText: '#364C49',
    spine: '#A8C0CE',
    accent: '#4A7A96',
  },
  {
    id: 'holiday',
    name: 'Праздник',
    pageBg: '#FFFBFB',
    coverBg: '#EDD5D5',
    coverText: '#364C49',
    spine: '#D4A5A5',
    accent: '#DD5757',
  },
  {
    id: 'graduation',
    name: 'Выпускной',
    pageBg: '#FDFCFF',
    coverBg: '#E0DCE8',
    coverText: '#364C49',
    spine: '#B8B0CC',
    accent: '#7B6FA0',
  },
];

export const DEFAULT_THEME_ID: ThemeId = 'minimal';

/** Returns theme by id; falls back to DEFAULT_THEME_ID if id is undefined or unknown. */
export function themeById(id: ThemeId | string | undefined): BookTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!;
}
