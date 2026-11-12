jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { BE } from './beDict';
import { tr } from './runtimeTranslate';
import { useSettingsStore } from '../settings/settingsStore';

describe('runtimeTranslate', () => {
  afterEach(() => useSettingsStore.setState({ lang: 'ru' }));

  it('на русском строки не меняются', () => {
    useSettingsStore.setState({ lang: 'ru' });
    expect(tr('Корзина')).toBe('Корзина');
  });

  it('на белорусском переводит по словарю, сохраняя пробелы по краям', () => {
    useSettingsStore.setState({ lang: 'be' });
    expect(tr('Корзина')).toBe('Кошык');
    expect(tr('  Сохранить ')).toBe('  Захаваць ');
  });

  it('строка без перевода остаётся русской', () => {
    useSettingsStore.setState({ lang: 'be' });
    expect(tr('Такого текста нет в словаре')).toBe('Такого текста нет в словаре');
  });

  it('словарь не содержит пустых переводов', () => {
    for (const [ru, be] of Object.entries(BE)) {
      expect(be.trim().length).toBeGreaterThan(0);
      expect(ru.trim().length).toBeGreaterThan(0);
    }
  });
});
