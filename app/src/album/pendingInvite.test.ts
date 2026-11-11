import { savePendingInvite, takePendingInvite } from './pendingInvite';

function memoryStore() {
  const map = new Map<string, string>();
  return {
    async getItem(k: string) {
      return map.has(k) ? map.get(k)! : null;
    },
    async setItem(k: string, v: string) {
      map.set(k, v);
    },
    async removeItem(k: string) {
      map.delete(k);
    },
  };
}

describe('pendingInvite', () => {
  it('запоминает токен и отдаёт его один раз', async () => {
    const s = memoryStore();
    await savePendingInvite('abc123', s);
    expect(await takePendingInvite(s)).toBe('abc123');
    expect(await takePendingInvite(s)).toBeNull();
  });
  it('без сохранённого токена отдаёт null', async () => {
    expect(await takePendingInvite(memoryStore())).toBeNull();
  });
  it('пустой токен не сохраняется', async () => {
    const s = memoryStore();
    await savePendingInvite('', s);
    expect(await takePendingInvite(s)).toBeNull();
  });
});
