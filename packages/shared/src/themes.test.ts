import { describe, it, expect } from 'vitest';
import { DEFAULT_THEME_ID, THEMES, themeById } from './themes';

const HEX_RE = /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?([0-9A-Fa-f]{2})?$/;

describe('themes', () => {
  it('содержит пять тем с уникальными id', () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toEqual(['minimal', 'film', 'travel', 'holiday', 'graduation']);
    expect(new Set(ids).size).toBe(5);
  });

  it('неизвестный или пустой id даёт тему по умолчанию', () => {
    expect(DEFAULT_THEME_ID).toBe('minimal');
    expect(themeById(undefined).id).toBe('minimal');
    expect(themeById('nope').id).toBe('minimal');
    expect(THEMES.find((t) => t.id === DEFAULT_THEME_ID)).toBeDefined();
  });

  it('находит тему по id', () => {
    for (const theme of THEMES) expect(themeById(theme.id).id).toBe(theme.id);
    expect(themeById('graduation').title).toBe('Выпускной');
  });

  it('поля и зазоры в допустимых пределах', () => {
    for (const t of THEMES) {
      expect(t.marginPct).toBeGreaterThanOrEqual(0);
      expect(t.marginPct).toBeLessThanOrEqual(0.12);
      expect(t.gapPct).toBeGreaterThanOrEqual(0);
      expect(t.gapPct).toBeLessThanOrEqual(0.12);
    }
  });

  it('тема minimal сохраняет прежние поля 4 px на странице 200 px', () => {
    const t = themeById('minimal');
    expect(Math.round(t.marginPct * 200)).toBe(4);
    expect(Math.round(t.gapPct * 200)).toBe(4);
  });

  it('все цвета темы — корректные hex-значения', () => {
    for (const theme of THEMES) {
      for (const field of ['pageBg', 'frameColor', 'coverBg', 'titleColor', 'coverText', 'spine', 'accent'] as const) {
        expect(theme[field], `${theme.id}.${field}`).toMatch(HEX_RE);
      }
    }
  });

  it('у каждой темы есть непустое название, а name совпадает с title', () => {
    for (const theme of THEMES) {
      expect(theme.title.trim().length).toBeGreaterThan(0);
      expect(theme.name).toBe(theme.title);
      expect(theme.coverText).toBe(theme.titleColor);
    }
  });
});
