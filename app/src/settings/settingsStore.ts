import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Lang = 'ru' | 'be' | 'en';

type SettingsState = {
  lang: Lang;
  notifications: boolean;
  onboardingSeen: boolean;
  /** Демо-переключатель: запросы к API падают с сетевой ошибкой. */
  failNetwork: boolean;
  setLang(lang: Lang): void;
  setNotifications(enabled: boolean): void;
  setOnboardingSeen(seen: boolean): void;
  setFailNetwork(on: boolean): void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      lang: 'ru',
      notifications: true,
      onboardingSeen: false,
      failNetwork: false,
      setLang: (lang) => set({ lang }),
      setNotifications: (notifications) => set({ notifications }),
      setOnboardingSeen: (onboardingSeen) => set({ onboardingSeen }),
      setFailNetwork: (failNetwork) => set({ failNetwork }),
    }),
    {
      name: 'picpac.settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
