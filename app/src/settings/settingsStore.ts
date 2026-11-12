import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Lang = 'ru' | 'be';

type SettingsState = {
  lang: Lang;
  notifications: boolean;
  onboardingSeen: boolean;
  setLang(lang: Lang): void;
  setNotifications(enabled: boolean): void;
  setOnboardingSeen(seen: boolean): void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      lang: 'ru',
      notifications: true,
      onboardingSeen: false,
      setLang: (lang) => set({ lang }),
      setNotifications: (notifications) => set({ notifications }),
      setOnboardingSeen: (onboardingSeen) => set({ onboardingSeen }),
    }),
    {
      name: 'picpac.settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
