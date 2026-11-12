import { THEMES, type ThemeId } from '@picpac/shared';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

type State = {
  choices: Record<string, ThemeId>;
  /** Запомнить тему, выбранную до первой раскладки книги. */
  set(projectId: string, themeId: ThemeId): void;
  get(projectId: string): ThemeId | undefined;
};

const known = new Set<string>(THEMES.map((t) => t.id));

// Хранилище подгружается лениво: тесты передают своё и не трогают нативный модуль.
const lazyStorage: StateStorage = {
  getItem: async (k) => (await import('@react-native-async-storage/async-storage')).default.getItem(k),
  setItem: async (k, v) => (await import('@react-native-async-storage/async-storage')).default.setItem(k, v),
  removeItem: async (k) => (await import('@react-native-async-storage/async-storage')).default.removeItem(k),
};

/** Оставляет только известные темы: испорченные значения из хранилища не должны ломать книгу. */
function cleanChoices(value: unknown): Record<string, ThemeId> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, ThemeId> = {};
  for (const [id, theme] of Object.entries(value)) {
    if (typeof theme === 'string' && known.has(theme)) out[id] = theme as ThemeId;
  }
  return out;
}

export function createThemeChoiceStore(storage: StateStorage = lazyStorage) {
  return create<State>()(
    persist(
      (set, get) => ({
        choices: {},
        set: (projectId, themeId) => set((s) => ({ choices: { ...s.choices, [projectId]: themeId } })),
        get: (projectId) => get().choices[projectId],
      }),
      {
        name: 'picpac.theme-choice',
        storage: createJSONStorage(() => storage),
        partialize: (s) => ({ choices: s.choices }),
        merge: (persisted, current) => ({
          ...current,
          choices: cleanChoices((persisted as { choices?: unknown } | null)?.choices),
        }),
      },
    ),
  );
}

export const useThemeChoice = createThemeChoiceStore();
