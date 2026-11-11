import type { ApiClient } from '../api/client';
import { startAiEdit } from './useAiJob';

describe('startAiEdit', () => {
  it('повторный вызов не создаёт две задачи', async () => {
    let resolve!: (value: { jobId: string }) => void;
    const pending = new Promise<{ jobId: string }>((r) => {
      resolve = r;
    });
    const post = jest.fn(() => pending);
    const client = {
      get: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      post,
    } as unknown as ApiClient;
    const inFlight = { current: null as Promise<{ jobId: string }> | null };
    const body = {
      projectId: '00000000-0000-4000-8000-000000000101',
      photoId: '00000000-0000-4000-8000-000000000201',
      prompt: 'retro',
    };
    const p1 = startAiEdit(client, body, inFlight);
    const p2 = startAiEdit(client, body, inFlight);
    expect(post).toHaveBeenCalledTimes(1);
    resolve({ jobId: '00000000-0000-4000-8000-000000000501' });
    await expect(p1).resolves.toMatchObject({ jobId: '00000000-0000-4000-8000-000000000501' });
    await expect(p2).resolves.toMatchObject({ jobId: '00000000-0000-4000-8000-000000000501' });
  });
});
