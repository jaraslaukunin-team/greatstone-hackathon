import { THEMES } from '@picpac/shared';
import { previewMetrics } from './ThemePicker';

describe('previewMetrics', () => {
  it('поля и зазор на превью положительные и растут вместе с темой', () => {
    for (const t of THEMES) {
      const m = previewMetrics(t);
      expect(m.margin).toBeGreaterThan(0);
      expect(m.gap).toBeGreaterThan(0);
    }
    const minimal = previewMetrics(THEMES.find((t) => t.id === 'minimal')!);
    const film = previewMetrics(THEMES.find((t) => t.id === 'film')!);
    expect(film.margin).toBeGreaterThan(minimal.margin);
  });
});
