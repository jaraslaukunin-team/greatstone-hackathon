export type ThemeMode = 'light' | 'dark';

export type ColorTokens = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  canvas: string;
};

export const lightColors: ColorTokens = {
  bg: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceMuted: '#F2EDE5',
  text: '#1F1B16',
  textMuted: '#6B645B',
  border: '#E6DFD4',
  accent: '#E5484D',
  accentSoft: 'rgba(229, 72, 77, 0.12)',
  success: '#2F8F5B',
  warning: '#C98A1A',
  danger: '#B42318',
  canvas: '#E9E6E1',
};

export const darkColors: ColorTokens = {
  bg: '#151311',
  surface: '#201D1A',
  surfaceMuted: '#2A2826',
  text: '#FAF7F2',
  textMuted: '#A39E96',
  border: '#3A3530',
  accent: '#E5484D',
  accentSoft: 'rgba(229, 72, 77, 0.2)',
  success: '#2F8F5B',
  warning: '#C98A1A',
  danger: '#B42318',
  canvas: '#2A2826',
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
  input: 8,
  card: 16,
  sheet: 24,
  button: 14,
  photo: 4,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, lineHeight: 40, fontFamily: 'Lora_600SemiBold' },
  h1: { fontSize: 24, lineHeight: 32, fontFamily: 'GolosText_600SemiBold' },
  h2: { fontSize: 20, lineHeight: 28, fontFamily: 'GolosText_600SemiBold' },
  body: { fontSize: 16, lineHeight: 24, fontFamily: 'GolosText_400Regular' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontFamily: 'GolosText_500Medium' },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: 'GolosText_400Regular' },
  price: { fontSize: 20, lineHeight: 24, fontFamily: 'GolosText_600SemiBold' },
} as const;

export const touch = {
  min: 44,
  buttonHeight: 52,
} as const;

export function colorsFor(mode: ThemeMode): ColorTokens {
  return mode === 'dark' ? darkColors : lightColors;
}
