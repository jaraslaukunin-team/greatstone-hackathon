export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem?(key: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
};

const TOKEN_KEY = 'picpac.auth.token';

export function createTokenStore(storage: KeyValueStore) {
  return {
    async get(): Promise<string | null> {
      try {
        return await storage.getItem(TOKEN_KEY);
      } catch {
        return null;
      }
    },
    async set(token: string): Promise<void> {
      await storage.setItem(TOKEN_KEY, token);
    },
    async clear(): Promise<void> {
      try {
        if (storage.deleteItem) await storage.deleteItem(TOKEN_KEY);
        else if (storage.removeItem) await storage.removeItem(TOKEN_KEY);
        else await storage.setItem(TOKEN_KEY, '');
      } catch {
        // ignore storage failures on clear
      }
    },
  };
}

export type TokenStore = ReturnType<typeof createTokenStore>;
