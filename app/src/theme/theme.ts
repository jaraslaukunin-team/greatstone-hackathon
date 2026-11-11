/**
 * Дизайн-токены PicPac. Источник — «Брендбук Pic Pac 2025», раздел «Сайт»
 * (Text / Action / Fills / System Background / Border / Accent Color) и Figma.
 *
 * Токены, которых нет в брендбуке, помечены «+» — их нужно утвердить с дизайнером.
 */

export type ThemeMode = 'light' | 'dark';

export type ColorTokens = {
  // System Background
  bg: string;
  surface: string;
  surfaceMuted: string;
  canvas: string;
  // Text Color
  text: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;
  // Border Color
  border: string;
  borderStrong: string;
  // Action Color
  accent: string;
  accentPressed: string;
  accentSoft: string;
  action: string;
  actionPressed: string;
  // Fills Color (плашки, подложки, категории)
  fillRose: string;
  fillSand: string;
  fillMint: string;
  fillSky: string;
  fillLilac: string;
  fillGrey: string;
  // Disabled
  disabledBg: string;
  disabledText: string;
  // Статусы
  success: string;
  warning: string;
  danger: string;
};

export const lightColors: ColorTokens = {
  bg: '#F6EFE6',
  surface: '#FFFFFF',
  surfaceMuted: '#FAF7F7',
  canvas: '#EDE1D5',

  text: '#364C49',
  // + брендовый #7C807F даёт контраст ~3.5:1 на #F6EFE6 — для мелкого текста темнее.
  textSecondary: '#566663',
  textMuted: '#7C807F',
  textOnAccent: '#FFFFFF',

  border: '#CCC7BF',
  borderStrong: '#BCBFB7',

  accent: '#DD5757',
  accentPressed: '#C44545', // +
  accentSoft: '#EDD5D5',
  action: '#364C49',
  actionPressed: '#283837', // +

  fillRose: '#EDD5D5',
  fillSand: '#EDE1D5',
  fillMint: '#C4DAD6',
  fillSky: '#CFDDE7',
  fillLilac: '#E0DCE8',
  fillGrey: '#DEDBDC',

  disabledBg: '#DEDBDC',
  disabledText: '#AEB4B3',

  success: '#4E8A3A', // + (брендовый зелёный #7AA45A слишком светлый для текста)
  warning: '#B8612E', // + тёмный вариант #E8996C
  danger: '#B5342F', // +
};

// + Тёмная тема в брендбуке не описана; значения взяты из Figma (страница Dark).
export const darkColors: ColorTokens = {
  bg: '#1A2422',
  surface: '#243330',
  surfaceMuted: '#2B3C39',
  canvas: '#2B3C39',

  text: '#F6EFE6',
  textSecondary: '#CCC7BF',
  textMuted: '#AEB4B3',
  textOnAccent: '#FFFFFF',

  border: '#3B4F4B',
  borderStrong: '#526663',

  accent: '#DD5757',
  accentPressed: '#C44545',
  accentSoft: 'rgba(221, 87, 87, 0.2)',
  action: '#F6EFE6',
  actionPressed: '#EDE1D5',

  fillRose: '#4A3736',
  fillSand: '#41403A',
  fillMint: '#34514E',
  fillSky: '#33454F',
  fillLilac: '#3F3C4A',
  fillGrey: '#33403D',

  disabledBg: '#2B3C39',
  disabledText: '#7C807F',

  success: '#7AA45A',
  warning: '#E8996C',
  danger: '#E97A75',
};

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
} as const;

export const radius = {
  input: 12,
  button: 14, // как в Figma
  card: 20,
  sheet: 28,
  photo: 4,
  pill: 999,
} as const;

/**
 * Futura PT (ParaType). Файлы лежат в `assets/fonts/futura-pt/` и подключаются
 * в `fonts.ts` по имени файла, без расширения.
 */
export const fonts = {
  light: 'FuturaPT-Light',
  book: 'FuturaPT-Book',
  medium: 'FuturaPT-Medium',
  demi: 'FuturaPT-Demi',
  bold: 'FuturaPT-Bold',
} as const;

// У Futura PT небольшой x-height, поэтому размеры на ступень крупнее, чем у обычных гротесков.
export const typography = {
  display: { fontSize: 36, lineHeight: 40, fontFamily: fonts.demi, letterSpacing: -0.6 },
  h1: { fontSize: 28, lineHeight: 34, fontFamily: fonts.demi, letterSpacing: -0.3 },
  h2: { fontSize: 22, lineHeight: 28, fontFamily: fonts.demi },
  h3: { fontSize: 18, lineHeight: 24, fontFamily: fonts.demi },
  body: { fontSize: 17, lineHeight: 25, fontFamily: fonts.book },
  bodyStrong: { fontSize: 17, lineHeight: 25, fontFamily: fonts.medium },
  caption: { fontSize: 14, lineHeight: 20, fontFamily: fonts.book },
  label: { fontSize: 13, lineHeight: 18, fontFamily: fonts.medium },
  button: { fontSize: 17, lineHeight: 22, fontFamily: fonts.demi },
  price: { fontSize: 22, lineHeight: 26, fontFamily: fonts.demi },
} as const;

export const touch = {
  min: 44,
  buttonHeight: 52,
} as const;

export function colorsFor(mode: ThemeMode): ColorTokens {
  return mode === 'dark' ? darkColors : lightColors;
}
