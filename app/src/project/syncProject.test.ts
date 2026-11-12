import type { Layout } from '@picpac/shared';
import { ApiRequestError } from '../api/client';
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

  it.each(['PROJECT_ORDERED', 'LAYOUT_INVALID'] as const)('отказ сервера %s передаётся в onRejected, а не считается сетевой ошибкой', async (code) => {
    const client = { put: jest.fn().mockRejectedValue(new ApiRequestError(409, code, 'нет')), get: jest.fn() };
    const onRejected = jest.fn();
    const onLocalOnly = jest.fn();
    await syncProject({
      client: client as never,
      projectId: 'p',
      layout,
      version: 3,
      onLocalOnly,
      onSaved: jest.fn(),
      onConflict: jest.fn(),
      onRejected,
    });
    expect(onRejected).toHaveBeenCalledWith(code);
    expect(onLocalOnly).not.toHaveBeenCalled();
  });
});
