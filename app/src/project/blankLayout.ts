import { DEFAULT_THEME_ID, type Layout, type ThemeId } from '@picpac/shared';

const DEFAULT_CROP = { x: 0, y: 0, scale: 1, rotation: 0 as const };

/**
 * Создаёт пустой макет для pagesMin страниц.
 * Каждая страница — шаблон one с одним пустым местом (photoId null).
 * themeId задаётся явно или берётся DEFAULT_THEME_ID.
 */
export function blankLayout(pagesMin: number, themeId: ThemeId = DEFAULT_THEME_ID): Layout {
  return {
    themeId,
    pages: Array.from({ length: pagesMin }, () => ({
      template: 'one' as const,
      cells: [{ photoId: null, crop: DEFAULT_CROP }],
    })),
  };
}
