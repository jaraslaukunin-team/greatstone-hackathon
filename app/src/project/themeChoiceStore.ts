import { DEFAULT_THEME_ID, THEMES, type ThemeId } from '@picpac/shared';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

/* ───────────── Тема по проекту ───────────── */

type State = {
  choices: Record<string, ThemeId>;
  initialPages: Record<string, number>;
  /** Запомнить параметры, выбранные до первой раскладки книги. */
  set(projectId: string, themeId: ThemeId, pages?: number): void;
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
        initialPages: {},
        set: (projectId, themeId, pages) =>
          set((s) => ({
            choices: { ...s.choices, [projectId]: themeId },
            initialPages: pages === undefined ? s.initialPages : { ...s.initialPages, [projectId]: pages },
          })),
        get: (projectId) => get().choices[projectId],
      }),
      {
        name: 'picpac.theme-choice',
        storage: createJSONStorage(() => storage),
        partialize: (s) => ({ choices: s.choices, initialPages: s.initialPages }),
        merge: (persisted, current) => {
          const saved = persisted as { choices?: unknown; initialPages?: unknown } | null;
          const entries = Object.entries(saved?.initialPages ?? {});
          return {
            ...current,
            choices: cleanChoices(saved?.choices),
            initialPages: Object.fromEntries(entries.filter(([, pages]) => typeof pages === 'number' && Number.isSafeInteger(pages) && pages > 0)),
          };
        },
      },
    ),
  );
}

export const useThemeChoice = createThemeChoiceStore();

/* ───────────── Режим сборки книги (общий выбор перед созданием проекта) ───────────── */

/** 'auto' — автомакет; 'manual' — пользователь раскладывает сам. */
export type BuildMode = 'auto' | 'manual';

type ThemeChoiceState = {
  themeId: ThemeId;
  mode: BuildMode;
  setThemeId(id: ThemeId): void;
  setMode(mode: BuildMode): void;
};

// Ключ отличается от picpac.theme-choice (тема по проекту): иначе два стора затирали бы друг друга.
export const useThemeChoiceStore = create<ThemeChoiceState>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME_ID,
      mode: 'auto',
      setThemeId: (themeId) => set({ themeId }),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'picpac.build-options',
      storage: createJSONStorage(() => lazyStorage),
    },
  ),
);
