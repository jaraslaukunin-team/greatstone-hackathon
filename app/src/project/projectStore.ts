import type { Layout, ProjectDTO } from '@picpac/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { sanitizeDraft } from './sanitizeDraft';

export type ProjectDraft = {
  project: ProjectDTO;
  layout: Layout;
  idempotencyKey: string | null;
};

type SyncState = 'saved' | 'saving' | 'local-only';

type ProjectState = {
  draft: ProjectDraft | null;
  syncState: SyncState;
  setDraft(project: ProjectDTO): void;
  setLayout(layout: Layout): void;
  setSyncState(state: SyncState): void;
  setIdempotencyKey(key: string | null): void;
  clear(): void;
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      draft: null,
      syncState: 'saved',
      setDraft(project) {
        set({
          draft: {
            project,
            layout: project.layout ?? { pages: [] },
            idempotencyKey: null,
          },
          syncState: 'saved',
        });
      },
      setLayout(layout) {
        set((state) => {
          if (!state.draft) return state;
          return {
            draft: {
              ...state.draft,
              layout,
              project: { ...state.draft.project, layout },
            },
            syncState: 'local-only',
          };
        });
      },
      setSyncState(syncState) {
        set({ syncState });
      },
      setIdempotencyKey(key) {
        set((state) => {
          if (!state.draft) return state;
          return {
            draft: { ...state.draft, idempotencyKey: key },
          };
        });
      },
      clear() {
        set({ draft: null, syncState: 'saved' });
      },
    }),
    {
      name: 'picpac.project-draft',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ draft: state.draft, syncState: state.syncState }),
      // Битый черновик от старой версии не должен ломать экраны: при запуске отбрасываем его.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { draft?: unknown; syncState?: SyncState };
        return {
          ...current,
          draft: sanitizeDraft<ProjectDraft>(saved.draft),
          syncState: saved.syncState ?? current.syncState,
        };
      },
    },
  ),
);
