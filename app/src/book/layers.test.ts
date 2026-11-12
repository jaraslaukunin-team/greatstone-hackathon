import { themeById, type Layout } from '@picpac/shared';
import {
  addPhotoLayer,
  addTextLayer,
  clampFrame,
  enableFree,
  frameRect,
  listLayers,
  moveAcrossFold,
  removeLayer,
  reorder,
  resizeKeepAspect,
  rotateBy,
  setFrame,
  toggleHidden,
  toggleLocked,
  type LayerRef,
} from './layers';

const crop = { x: 0, y: 0, scale: 1, rotation: 0 as const };
const frame = (over: object = {}) => ({ x: 0.5, y: 0.5, w: 0.4, h: 0.3, rot: 0, ...over });
const base = (): Layout => ({
  pages: [
    { template: 'one', cells: [{ photoId: 'x', crop }] },
    {
      template: 'two',
      cells: [
        { photoId: 'a', crop, frame: frame() },
        { photoId: 'b', crop, frame: frame({ x: 0.2 }) },
      ],
      texts: [{ text: 'Наше лето', x: 0.5, y: 0.9, style: 'title' }],
    },
    { template: 'one', cells: [{ photoId: 'c', crop, frame: frame({ x: 0.7 }) }] },
  ],
});
const cellRef = (pageIndex: number, index: number): LayerRef => ({ kind: 'cell', pageIndex, index });
const textRef = (pageIndex: number, index: number): LayerRef => ({ kind: 'text', pageIndex, index });

describe('clampFrame', () => {
  it('зажимает центр, размер и поворот', () => {
    expect(clampFrame({ x: 5, y: -5, w: 0, h: 9, rot: 200 })).toEqual({ x: 1.1, y: -0.1, w: 0.05, h: 1.2, rot: -160 });
  });
});

describe('frameRect', () => {
  it('центр и размер в долях → прямоугольник и угол', () => {
    expect(frameRect({ x: 0.5, y: 0.5, w: 0.5, h: 0.25, rot: -8 }, 200, 100)).toEqual({ left: 50, top: 37.5, width: 100, height: 25, rotate: -8 });
  });
});

describe('enableFree', () => {
  it('каждой ячейке даёт рамку по её прямоугольнику, не меняя уже свободные', () => {
    const layout = base();
    const r = enableFree(layout, 0, themeById('minimal'), { width: 200, height: 200 });
    const f = r.pages[0]!.cells[0]!.frame!;
    expect(f.w).toBeCloseTo(1 - 2 * themeById('minimal').marginPct, 5);
    expect(f.x).toBeCloseTo(0.5, 5);
    expect(f.rot).toBe(0);
    expect(enableFree(layout, 1, themeById('minimal'), { width: 200, height: 200 }).pages[1]).toEqual(layout.pages[1]);
    expect(layout.pages[0]!.cells[0]!.frame).toBeUndefined();
  });
});

describe('setFrame / resizeKeepAspect / rotateBy', () => {
  it('setFrame зажимает границы', () => {
    const r = setFrame(base(), cellRef(1, 0), { x: 9, w: 0 });
    expect(r.pages[1]!.cells[0]!.frame).toMatchObject({ x: 1.1, w: 0.05 });
  });
  it('resizeKeepAspect сохраняет пропорции и не выходит за границы', () => {
    const r = resizeKeepAspect(base(), cellRef(1, 0), 2);
    expect(r.pages[1]!.cells[0]!.frame).toMatchObject({ w: 0.8, h: 0.6 });
    const huge = resizeKeepAspect(base(), cellRef(1, 0), 50).pages[1]!.cells[0]!.frame!;
    expect(huge.w).toBeLessThanOrEqual(1.2);
    expect(huge.w / huge.h).toBeCloseTo(0.4 / 0.3, 5);
  });
  it('rotateBy нормализует угол в -180..180', () => {
    const r = rotateBy(base(), cellRef(1, 0), 190);
    expect(r.pages[1]!.cells[0]!.frame!.rot).toBe(-170);
    expect(rotateBy(base(), textRef(1, 0), 10).pages[1]!.texts![0]!.rot).toBe(10);
  });
  it('закреплённый слой не меняется, исходный макет не мутируется', () => {
    const layout = base();
    const locked = toggleLocked(layout, cellRef(1, 0));
    expect(locked.pages[1]!.cells[0]!.locked).toBe(true);
    expect(layout.pages[1]!.cells[0]!.locked).toBeUndefined();
    expect(setFrame(locked, cellRef(1, 0), { x: 0.9 })).toEqual(locked);
    expect(resizeKeepAspect(locked, cellRef(1, 0), 2)).toEqual(locked);
    expect(rotateBy(locked, cellRef(1, 0), 5)).toEqual(locked);
    expect(reorder(locked, cellRef(1, 0), 'front').layout).toEqual(locked);
    expect(removeLayer(locked, cellRef(1, 0))).toEqual(locked);
    expect(toggleLocked(locked, cellRef(1, 0)).pages[1]!.cells[0]!.locked).toBe(false);
  });
});

describe('reorder', () => {
  it('front/back/forward/backward двигают слой в cells и возвращают новую ссылку', () => {
    const layout = base();
    const front = reorder(layout, cellRef(1, 0), 'front');
    expect(front.layout.pages[1]!.cells.map((c) => c.photoId)).toEqual(['b', 'a']);
    expect(front.ref).toEqual(cellRef(1, 1));
    const back = reorder(layout, cellRef(1, 1), 'back');
    expect(back.layout.pages[1]!.cells.map((c) => c.photoId)).toEqual(['b', 'a']);
    expect(back.ref).toEqual(cellRef(1, 0));
    const fwd = reorder(layout, cellRef(1, 0), 'forward');
    expect(fwd.layout.pages[1]!.cells.map((c) => c.photoId)).toEqual(['b', 'a']);
    expect(reorder(layout, cellRef(1, 1), 'forward').ref).toEqual(cellRef(1, 1));
    expect(reorder(layout, cellRef(1, 0), 'backward').ref).toEqual(cellRef(1, 0));
  });
});

describe('hidden, remove, add', () => {
  it('скрытый слой остаётся в макете вместе с фото', () => {
    const r = toggleHidden(base(), cellRef(1, 0));
    expect(r.pages[1]!.cells[0]).toMatchObject({ photoId: 'a', hidden: true });
    expect(toggleHidden(r, cellRef(1, 0)).pages[1]!.cells[0]!.hidden).toBe(false);
  });
  it('removeLayer убирает ячейку или подпись', () => {
    expect(removeLayer(base(), cellRef(1, 0)).pages[1]!.cells.map((c) => c.photoId)).toEqual(['b']);
    expect(removeLayer(base(), textRef(1, 0)).pages[1]!.texts).toEqual([]);
  });
  it('addPhotoLayer кладёт фото сверху с рамкой по пропорциям; предел 60 ячеек', () => {
    const r = addPhotoLayer(base(), 1, 'z', 1.5);
    expect(r.layout.pages[1]!.cells).toHaveLength(3);
    expect(r.ref).toEqual(cellRef(1, 2));
    const f = r.layout.pages[1]!.cells[2]!;
    expect(f).toMatchObject({ photoId: 'z', fit: 'cover', border: true });
    expect(f.frame!.w / f.frame!.h).toBeCloseTo(1.5, 5);
    const full: Layout = { pages: [{ template: 'one', cells: Array.from({ length: 60 }, () => ({ photoId: 'a', crop })) }] };
    const blocked = addPhotoLayer(full, 0, 'z', 1);
    expect(blocked.ref).toBeNull();
    expect(blocked.layout.pages[0]!.cells).toHaveLength(60);
  });
  it('addTextLayer добавляет подпись и уважает предел 20', () => {
    const r = addTextLayer(base(), 1, 'caption', 'Тот самый день');
    expect(r.layout.pages[1]!.texts).toHaveLength(2);
    expect(r.ref).toEqual(textRef(1, 1));
    const many: Layout = { pages: [{ template: 'one', cells: [], texts: Array.from({ length: 20 }, () => ({ text: 't', x: 0.5, y: 0.5, style: 'title' as const })) }] };
    expect(addTextLayer(many, 0, 'title', 'x').ref).toBeNull();
  });
});

describe('listLayers', () => {
  it('сверху вниз: подписи, затем фото-слои в обратном порядке', () => {
    const names = (id: string) => `фото ${id}`;
    const list = listLayers(base(), [1, 2], names);
    expect(list.map((l) => l.name)).toEqual(['Наше лето', 'фото c', 'фото b', 'фото a']);
    expect(list[0]!.ref).toEqual(textRef(1, 0));
    expect(list.map((l) => l.hidden)).toEqual([false, false, false, false]);
  });
});

describe('moveAcrossFold', () => {
  it('слой переходит на соседнюю страницу, не теряя и не дублируя фото', () => {
    const layout = base();
    const r = moveAcrossFold(layout, cellRef(1, 0), 2, 1.05);
    expect(r.layout.pages[1]!.cells.map((c) => c.photoId)).toEqual(['b']);
    expect(r.layout.pages[2]!.cells.map((c) => c.photoId)).toEqual(['c', 'a']);
    expect(r.layout.pages[2]!.cells[1]!.frame!.x).toBeCloseTo(0.05, 5);
    expect(r.ref).toEqual(cellRef(2, 1));
    const total = (l: Layout) => l.pages.flatMap((p) => p.cells.map((c) => c.photoId)).sort().join();
    expect(total(r.layout)).toBe(total(layout));
  });
  it('закреплённый слой не переносится', () => {
    const locked = toggleLocked(base(), cellRef(1, 0));
    expect(moveAcrossFold(locked, cellRef(1, 0), 2, 1.05).layout).toEqual(locked);
  });
});
