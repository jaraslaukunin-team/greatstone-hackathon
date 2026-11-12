jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { BE } from './beDict';
import { EN } from './enDict';
import { strings } from './strings';
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

  it('на английском переводит по словарю, сохраняя пробелы по краям', () => {
    useSettingsStore.setState({ lang: 'en' });
    expect(tr('Корзина')).toBe('Cart');
    expect(tr('  Сохранить ')).toBe('  Save ');
    expect(tr('Такого текста нет в словаре')).toBe('Такого текста нет в словаре');
  });

  it('английский словарь покрывает все ключи белорусского и не содержит пустых значений', () => {
    for (const key of Object.keys(BE)) expect(EN[key]).toBeDefined();
    for (const value of Object.values(EN)) expect(value.trim().length).toBeGreaterThan(0);
  });

  it('английские строки экранов не пустые и повторяют структуру русских', () => {
    expect(Object.keys(strings.en)).toEqual(Object.keys(strings.ru));
    expect(strings.en.profile.langEn).toBe('English');
    expect(strings.en.onboarding.cards).toHaveLength(strings.ru.onboarding.cards.length);
    expect(strings.en.faq.items).toHaveLength(strings.ru.faq.items.length);
  });
});
