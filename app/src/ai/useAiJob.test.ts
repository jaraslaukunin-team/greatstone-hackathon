import { startAiEdit } from './useAiJob';
import type { AiJobDTO } from '@picpac/shared';

describe('startAiEdit', () => {
  it('повторный вызов не создаёт две задачи', async () => {
    let resolve!: (value: AiJobDTO) => void;
    const pending = new Promise<AiJobDTO>((r) => {
      resolve = r;
    });
    const post = jest.fn(() => pending);
    const client = {
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      post,
    };
    const inFlight = { current: null as Promise<AiJobDTO> | null };
    const p1 = startAiEdit(client, { photoId: 'p', prompt: 'retro' }, inFlight);
    const p2 = startAiEdit(client, { photoId: 'p', prompt: 'retro' }, inFlight);
    expect(post).toHaveBeenCalledTimes(1);
    resolve({ id: '00000000-0000-4000-8000-000000000501', status: 'pending' });
    await expect(p1).resolves.toMatchObject({ status: 'pending' });
    await expect(p2).resolves.toMatchObject({ status: 'pending' });
  });
});
