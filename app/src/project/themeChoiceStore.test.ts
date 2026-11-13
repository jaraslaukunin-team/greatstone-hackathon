import { createThemeChoiceStore } from './themeChoiceStore';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
    removeItem: (k: string) => {
      delete data[k];
    },
  };
}

describe('themeChoiceStore', () => {
  it('запоминает тему проекта и отдаёт её', () => {
    const store = createThemeChoiceStore(memoryStorage());
    store.getState().set('p1', 'film');
    expect(store.getState().get('p1')).toBe('film');
  });

  it('для неизвестного проекта темы нет', () => {
    const store = createThemeChoiceStore(memoryStorage());
    expect(store.getState().get('nope')).toBeUndefined();
  });

  it('выбор переживает перезапуск: читается из хранилища', () => {
    const storage = memoryStorage();
    createThemeChoiceStore(storage).getState().set('p1', 'travel');
    expect(createThemeChoiceStore(storage).getState().get('p1')).toBe('travel');
  });

  it('восстанавливает выбранное число страниц отдельно для каждого проекта', () => {
    const storage = memoryStorage();
    const store = createThemeChoiceStore(storage);
    store.getState().set('p1', 'travel', 32);
    store.getState().set('p2', 'film');

    const restored = createThemeChoiceStore(storage);
    expect(restored.getState().initialPages).toEqual({ p1: 32 });
  });

  it('отбрасывает испорченные значения числа страниц', () => {
    const storage = memoryStorage({
      'picpac.theme-choice': JSON.stringify({
        state: { initialPages: { p1: 32, p2: '32', p3: -2, p4: 3.5 } },
        version: 0,
      }),
    });
    expect(createThemeChoiceStore(storage).getState().initialPages).toEqual({ p1: 32 });
  });

  it('испорченное сохранённое значение отбрасывается, остальные остаются', () => {
    const storage = memoryStorage({
      'picpac.theme-choice': JSON.stringify({ state: { choices: { p1: 'film', p2: 'zzz', p3: 5 } }, version: 0 }),
    });
    const store = createThemeChoiceStore(storage);
    expect(store.getState().get('p1')).toBe('film');
    expect(store.getState().get('p2')).toBeUndefined();
    expect(store.getState().get('p3')).toBeUndefined();
  });

  it('мусор вместо объекта не ломает стор', () => {
    const storage = memoryStorage({ 'picpac.theme-choice': '{"state":{"choices":"oops"},"version":0}' });
    expect(createThemeChoiceStore(storage).getState().get('p1')).toBeUndefined();
  });
});
