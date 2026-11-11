import { createTokenStore } from './tokenStore';

function memoryStore() {
  const map = new Map<string, string>();
  return {
    async getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    async setItem(key: string, value: string) {
      map.set(key, value);
    },
    async deleteItem(key: string) {
      map.delete(key);
    },
  };
}

describe('tokenStore', () => {
  it('сохраняет и читает токен', async () => {
    const store = createTokenStore(memoryStore());
    await store.set('abc');
    await expect(store.get()).resolves.toBe('abc');
  });

  it('при ошибке хранилища get() возвращает null', async () => {
    const store = createTokenStore({
      async getItem() {
        throw new Error('boom');
      },
      async setItem() {
        throw new Error('boom');
      },
    });
    await expect(store.get()).resolves.toBeNull();
  });
});
