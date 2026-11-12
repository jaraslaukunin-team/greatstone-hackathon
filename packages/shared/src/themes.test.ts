import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME_ID, THEMES, themeById } from './themes';

const HEX_RE = /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?([0-9A-Fa-f]{2})?$/;

describe('THEMES', () => {
  it('has exactly 5 entries', () => {
    expect(THEMES).toHaveLength(5);
  });

  it('contains minimal, film, travel, holiday, graduation', () => {
    const ids = THEMES.map((t) => t.id);
    expect(ids).toContain('minimal');
    expect(ids).toContain('film');
    expect(ids).toContain('travel');
    expect(ids).toContain('holiday');
    expect(ids).toContain('graduation');
  });

  it('all color fields are valid hex strings', () => {
    for (const theme of THEMES) {
      for (const field of ['pageBg', 'coverBg', 'coverText', 'spine', 'accent'] as const) {
        expect(theme[field], `${theme.id}.${field}`).toMatch(HEX_RE);
      }
    }
  });

  it('all themes have non-empty names', () => {
    for (const theme of THEMES) {
      expect(theme.name.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('themeById', () => {
  it('returns the correct theme for each known id', () => {
    for (const theme of THEMES) {
      expect(themeById(theme.id).id).toBe(theme.id);
    }
  });

  it('falls back to default for undefined', () => {
    expect(themeById(undefined).id).toBe(DEFAULT_THEME_ID);
  });

  it('falls back to default for an unknown id', () => {
    expect(themeById('nonexistent').id).toBe(DEFAULT_THEME_ID);
  });

  it('default theme exists in THEMES', () => {
    expect(THEMES.find((t) => t.id === DEFAULT_THEME_ID)).toBeDefined();
  });
});
