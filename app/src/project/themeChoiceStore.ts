import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_THEME_ID, type ThemeId } from '@picpac/shared';

/** 'auto' — автомакет; 'manual' — пользователь раскладывает сам. */
export type BuildMode = 'auto' | 'manual';

type ThemeChoiceState = {
  themeId: ThemeId;
  mode: BuildMode;
  setThemeId(id: ThemeId): void;
  setMode(mode: BuildMode): void;
};

export const useThemeChoiceStore = create<ThemeChoiceState>()(
  persist(
    (set) => ({
      themeId: DEFAULT_THEME_ID,
      mode: 'auto',
      setThemeId: (themeId) => set({ themeId }),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'picpac.theme-choice',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
