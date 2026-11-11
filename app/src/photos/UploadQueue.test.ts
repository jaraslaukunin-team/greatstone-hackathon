import { UploadQueue, type UploadTask } from './UploadQueue';

function memoryStore() {
  const map = new Map<string, string>();
  return {
    async getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    async setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('UploadQueue', () => {
  it('выполняет задачу и вызывает onChange с прогрессом', async () => {
    const states: number[] = [];
    const upload = jest.fn(async (_task: UploadTask) => ({ id: 'p1' }));
    const queue = new UploadQueue({
      upload,
      storage: memoryStore(),
      isOnline: () => true,
      delay: async () => undefined,
    });
    queue.onChange((state) => {
      states.push(state.items[0]?.progress ?? -1);
    });
    queue.enqueue({ localId: 'a', projectId: 'proj', uri: 'file://a.jpg' });
    await queue.resume();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(states.some((p) => p > 0)).toBe(true);
    expect(states.at(-1)).toBe(1);
  });

  it('не отправляет офлайн и отправляет после resume', async () => {
    let online = false;
    const upload = jest.fn(async () => ({ id: 'p1' }));
    const queue = new UploadQueue({
      upload,
      storage: memoryStore(),
      isOnline: () => online,
      delay: async () => undefined,
    });
    queue.enqueue({ localId: 'a', projectId: 'proj', uri: 'file://a.jpg' });
    await queue.resume();
    expect(upload).not.toHaveBeenCalled();
    online = true;
    await queue.resume();
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('повторяет после ошибки upload', async () => {
    let fails = 1;
    const upload = jest.fn(async () => {
      if (fails > 0) {
        fails -= 1;
        throw new Error('fail');
      }
      return { id: 'p1' };
    });
    const queue = new UploadQueue({
      upload,
      storage: memoryStore(),
      isOnline: () => true,
      delay: async () => undefined,
    });
    queue.enqueue({ localId: 'a', projectId: 'proj', uri: 'file://a.jpg' });
    await queue.resume();
    expect(upload.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('восстанавливается из storage и не дублирует localId', async () => {
    const storage = memoryStore();
    const upload = jest.fn(async () => ({ id: 'p1' }));
    const first = new UploadQueue({
      upload,
      storage,
      isOnline: () => false,
      delay: async () => undefined,
    });
    first.enqueue({ localId: 'a', projectId: 'proj', uri: 'file://a.jpg' });
    first.enqueue({ localId: 'a', projectId: 'proj', uri: 'file://a.jpg' });

    const second = new UploadQueue({
      upload,
      storage,
      isOnline: () => true,
      delay: async () => undefined,
    });
    await second.hydrate();
    await second.resume();
    expect(upload).toHaveBeenCalledTimes(1);
  });
});
