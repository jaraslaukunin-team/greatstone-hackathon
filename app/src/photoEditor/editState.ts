import type { Rotation } from '@picpac/shared';

export type { Rotation };
export type FilterId = 'original' | 'bw' | 'sepia' | 'warm' | 'cool' | 'vintage' | 'vivid' | 'soft';

/** Рамка обрезки в долях исходного фото (0..1). */
export type CropRect = { x: number; y: number; w: number; h: number };
export type Adjust = { brightness: number; contrast: number; saturation: number; warmth: number };
/** Надпись: x, y — центр, size — высота букв; всё в долях кадра после обрезки. */
export type TextItem = { id: string; text: string; x: number; y: number; size: number; color: string };
/** Штрих кисти: точки в долях кадра после обрезки, width — доля ширины кадра. */
export type Stroke = { color: string; width: number; points: [number, number][] };

export type EditState = {
  crop: CropRect;
  rotation: Rotation;
  flipX: boolean;
  adjust: Adjust;
  filterId: FilterId;
  texts: TextItem[];
  strokes: Stroke[];
};

/**
 * past/future — шаги отмены и повтора. committed — состояние после последнего завершённого действия:
 * пока человек тянет ползунок (preview), present меняется, а в историю попадёт только committed.
 */
export type History = { past: EditState[]; present: EditState; future: EditState[]; committed: EditState };

export type EditAction =
  | { type: 'commit'; patch: Partial<EditState> }
  | { type: 'preview'; patch: Partial<EditState> }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' };

export const MAX_HISTORY = 50;

export function initialState(): EditState {
  return {
    crop: { x: 0, y: 0, w: 1, h: 1 },
    rotation: 0,
    flipX: false,
    adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
    filterId: 'original',
    texts: [],
    strokes: [],
  };
}

export function initialHistory(): History {
  const state = initialState();
  return { past: [], present: state, future: [], committed: state };
}

export function editReducer(h: History, action: EditAction): History {
  switch (action.type) {
    case 'preview':
      return { ...h, present: { ...h.present, ...action.patch } };
    case 'commit': {
      const present = { ...h.present, ...action.patch };
      return { past: [...h.past, h.committed].slice(-MAX_HISTORY), present, future: [], committed: present };
    }
    case 'undo': {
      const previous = h.past[h.past.length - 1];
      if (!previous) return h;
      return { past: h.past.slice(0, -1), present: previous, future: [h.committed, ...h.future], committed: previous };
    }
    case 'redo': {
      const [next, ...rest] = h.future;
      if (!next) return h;
      return { past: [...h.past, h.committed], present: next, future: rest, committed: next };
    }
    case 'reset':
      return initialHistory();
  }
}
