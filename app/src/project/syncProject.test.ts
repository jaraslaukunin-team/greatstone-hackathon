import type { Layout } from '@picpac/shared';
import { syncProject } from './syncProject';

const layout: Layout = { pages: [] };

describe('syncProject', () => {
  it('принимает ответ сервера, в котором только новая версия', async () => {
    const client = { put: jest.fn().mockResolvedValue({ version: 4 }), get: jest.fn() };
    const onSaved = jest.fn();
    await syncProject({
      client: client as never,
      projectId: 'p',
      layout,
      version: 3,
      onLocalOnly: jest.fn(),
      onSaved,
      onConflict: jest.fn(),
    });
    expect(client.put).toHaveBeenCalledWith('/projects/p', { layout, version: 3 });
    expect(onSaved).toHaveBeenCalledWith({ version: 4 });
  });
});
