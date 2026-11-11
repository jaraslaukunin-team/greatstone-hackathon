const KEY = 'picpac.pending-invite';

type Store = {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
};

// Хранилище подгружается лениво: тесты передают своё и не трогают нативный модуль.
async function defaultStore(): Promise<Store> {
  return (await import('@react-native-async-storage/async-storage')).default;
}

/** Приглашение, открытое до входа: запоминаем токен, чтобы принять его сразу после входа. */
export async function savePendingInvite(token: string, store?: Store): Promise<void> {
  if (!token) return;
  await (store ?? (await defaultStore())).setItem(KEY, token);
}

/** Отдаёт запомненный токен один раз и забывает его. */
export async function takePendingInvite(store?: Store): Promise<string | null> {
  const s = store ?? (await defaultStore());
  const token = await s.getItem(KEY);
  if (token) await s.removeItem(KEY);
  return token || null;
}
