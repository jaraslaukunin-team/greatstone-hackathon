import { describe, it, expect } from 'vitest';
import { DEFAULT_THEME_ID, THEMES, themeById } from './themes';

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
  });

  it('находит тему по id', () => {
    expect(themeById('film').id).toBe('film');
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
});
