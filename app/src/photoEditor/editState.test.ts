import { editReducer, initialHistory, type History } from './editState';

function commitN(h: History, n: number): History {
  let next = h;
  for (let i = 1; i <= n; i++) next = editReducer(next, { type: 'commit', patch: { flipX: i % 2 === 1 } });
  return next;
}

describe('editReducer', () => {
  it('начальное состояние: целый кадр, без поворота, настроек, фильтра, надписей и штрихов', () => {
    const { present } = initialHistory();
    expect(present).toEqual({
      crop: { x: 0, y: 0, w: 1, h: 1 },
      rotation: 0,
      flipX: false,
      adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
      filterId: 'original',
      texts: [],
      strokes: [],
    });
  });

  it('commit кладёт прежнее состояние в past и очищает future', () => {
    const start = initialHistory();
    const done = editReducer(start, { type: 'commit', patch: { filterId: 'sepia' } });
    expect(done.present.filterId).toBe('sepia');
    expect(done.past).toEqual([start.present]);
    expect(done.future).toEqual([]);
  });

  it('undo, затем redo возвращают состояние', () => {
    const done = editReducer(initialHistory(), { type: 'commit', patch: { filterId: 'bw' } });
    const undone = editReducer(done, { type: 'undo' });
    expect(undone.present.filterId).toBe('original');
    expect(undone.future).toHaveLength(1);
    const redone = editReducer(undone, { type: 'redo' });
    expect(redone.present.filterId).toBe('bw');
  });

  it('новое действие после undo очищает redo', () => {
    let h = editReducer(initialHistory(), { type: 'commit', patch: { filterId: 'bw' } });
    h = editReducer(h, { type: 'undo' });
    h = editReducer(h, { type: 'commit', patch: { filterId: 'warm' } });
    expect(h.future).toEqual([]);
  });

  it('preview меняет экран, но не историю; следующий commit записывает состояние до движения ползунка', () => {
    const start = initialHistory();
    let h = start;
    for (const brightness of [10, 30, 55]) {
      h = editReducer(h, { type: 'preview', patch: { adjust: { ...start.present.adjust, brightness } } });
    }
    expect(h.past).toHaveLength(0);
    expect(h.present.adjust.brightness).toBe(55);

    h = editReducer(h, { type: 'commit', patch: { adjust: { ...start.present.adjust, brightness: 55 } } });
    expect(h.past).toHaveLength(1);
    expect(h.past[0]!.adjust.brightness).toBe(0);

    h = editReducer(h, { type: 'undo' });
    expect(h.present.adjust.brightness).toBe(0);
  });

  it('история ограничена 50 шагами', () => {
    const h = commitN(initialHistory(), 60);
    expect(h.past).toHaveLength(50);
  });

  it('undo и redo на пустой истории ничего не меняют', () => {
    const start = initialHistory();
    expect(editReducer(start, { type: 'undo' })).toEqual(start);
    expect(editReducer(start, { type: 'redo' })).toEqual(start);
  });

  it('reset возвращает исходное состояние и пустую историю', () => {
    const h = editReducer(initialHistory(), { type: 'commit', patch: { filterId: 'vivid' } });
    expect(editReducer(h, { type: 'reset' })).toEqual(initialHistory());
  });

  it('commit не меняет переданный патч и прежнее состояние', () => {
    const start = initialHistory();
    const snapshot = JSON.stringify(start);
    editReducer(start, { type: 'commit', patch: { texts: [{ id: 't', text: 'Привет', x: 0.5, y: 0.5, size: 0.08, color: '#FFFFFF' }] } });
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});
