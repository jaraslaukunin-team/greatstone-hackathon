import type { PhotoDTO } from '@picpac/shared';
import { create } from 'zustand';

type State = {
  results: Record<string, PhotoDTO>;
  /** Редактор положил готовое фото по номеру запроса. */
  set(requestId: string, photo: PhotoDTO): void;
  /** Вызвавший экран забирает результат один раз; чужие запросы не затрагиваются. */
  take(requestId: string): PhotoDTO | null;
};

/** Мост между экраном-заказчиком и редактором: без persist, живёт, пока открыто приложение. */
export const useEditResult = create<State>()((set, get) => ({
  results: {},
  set: (requestId, photo) => set((s) => ({ results: { ...s.results, [requestId]: photo } })),
  take: (requestId) => {
    const photo = get().results[requestId];
    if (!photo) return null;
    set((s) => {
      const { [requestId]: _taken, ...rest } = s.results;
      return { results: rest };
    });
    return photo;
  },
}));
