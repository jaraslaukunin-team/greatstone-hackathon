import { startAiEdit } from './useAiJob';
import type { AiJobDTO } from '@picpac/shared';

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
      delete: jest.fn(),
      post,
      patch: jest.fn(),
      upload: jest.fn(),
      resolveUrl: (p: string) => p,
    };
    const inFlight = { current: null as Promise<AiJobDTO> | null };
    const p1 = startAiEdit(client, { projectId: 'proj', photoId: 'p', prompt: 'retro' }, inFlight);
    const p2 = startAiEdit(client, { projectId: 'proj', photoId: 'p', prompt: 'retro' }, inFlight);
    expect(post).toHaveBeenCalledTimes(1);
    resolve({ jobId: '00000000-0000-4000-8000-000000000501' });
    await expect(p1).resolves.toMatchObject({ id: '00000000-0000-4000-8000-000000000501', status: 'pending' });
    await expect(p2).resolves.toMatchObject({ id: '00000000-0000-4000-8000-000000000501', status: 'pending' });
  });
});
