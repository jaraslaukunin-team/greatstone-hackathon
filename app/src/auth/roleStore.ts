import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RoleMode } from './roleMode';

/** Выбранная на входе роль запоминается на устройстве; сама роль аккаунта всегда приходит с сервера. */
export const useRoleMode = create<{ mode: RoleMode | null; setMode(mode: RoleMode | null): void }>()(
  persist(
    (set) => ({ mode: null, setMode: (mode) => set({ mode }) }),
    {
      name: 'picpac.role-mode',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ mode: s.mode }),
      merge: (persisted, current) => {
        const m = (persisted as { mode?: unknown } | null)?.mode;
        return { ...current, mode: m === 'customer' || m === 'staff' ? m : null };
      },
    },
  ),
);
