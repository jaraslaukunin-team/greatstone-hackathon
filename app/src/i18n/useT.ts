import { strings, type Strings } from './strings';
import { useSettingsStore } from '../settings/settingsStore';

/** Returns the translation object for the current language. */
export function useT(): Strings {
  const lang = useSettingsStore((s) => s.lang);
  return strings[lang];
}

/** Returns translations for a given lang without subscribing to the store.
 *  Useful in pure functions and tests. */
export function t(lang: 'ru' | 'be'): Strings {
  return strings[lang];
}
