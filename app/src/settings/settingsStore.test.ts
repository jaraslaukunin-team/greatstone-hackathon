// Mock AsyncStorage before importing the store (which uses it via zustand/persist)
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    mergeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    getAllKeys: jest.fn(() => Promise.resolve([])),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  },
}));

import { useSettingsStore } from './settingsStore';

// Reset store to defaults between tests
beforeEach(() => {
  useSettingsStore.setState({
    lang: 'ru',
    notifications: true,
    onboardingSeen: false,
  });
});

test('initial state', () => {
  const s = useSettingsStore.getState();
  expect(s.lang).toBe('ru');
  expect(s.notifications).toBe(true);
  expect(s.onboardingSeen).toBe(false);
});

test('setLang switches language', () => {
  useSettingsStore.getState().setLang('be');
  expect(useSettingsStore.getState().lang).toBe('be');
});

test('setLang round-trips ru/be', () => {
  useSettingsStore.getState().setLang('be');
  useSettingsStore.getState().setLang('ru');
  expect(useSettingsStore.getState().lang).toBe('ru');
});

test('setNotifications to false', () => {
  useSettingsStore.getState().setNotifications(false);
  expect(useSettingsStore.getState().notifications).toBe(false);
});

test('setNotifications to true', () => {
  useSettingsStore.setState({ notifications: false });
  useSettingsStore.getState().setNotifications(true);
  expect(useSettingsStore.getState().notifications).toBe(true);
});

test('setOnboardingSeen marks as seen', () => {
  useSettingsStore.getState().setOnboardingSeen(true);
  expect(useSettingsStore.getState().onboardingSeen).toBe(true);
});
