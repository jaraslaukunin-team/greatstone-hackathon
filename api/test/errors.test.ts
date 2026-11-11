import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { AppError } from '../src/errors.js';
import { testApp } from './helpers.js';

describe('обработчик ошибок', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    ({ app } = await testApp());
    app.get('/t/app-error', async () => {
      throw new AppError(409, 'CONFLICT_TEST', 'Конфликт данных');
    });
    app.get('/t/boom', async () => {
      throw new Error('secret');
    });
    app.post('/t/json', async () => ({ ok: true }));
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('AppError превращается в ApiErrorBody со своим статусом', async () => {
    const res = await app.inject({ method: 'GET', url: '/t/app-error' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'CONFLICT_TEST', message: 'Конфликт данных' } });
  });

  it('неизвестная ошибка даёт 500 INTERNAL без утечки деталей', async () => {
    const res = await app.inject({ method: 'GET', url: '/t/boom' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('INTERNAL');
    expect(res.body).not.toContain('secret');
  });

  it('415 сохраняет статус и получает свой код', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/t/json',
      headers: { 'content-type': 'application/x-weird' },
      payload: 'x',
    });
    expect(res.statusCode).toBe(415);
    expect(res.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('413 сохраняет статус и получает свой код', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/t/json',
      headers: { 'content-type': 'application/json' },
      payload: 'x'.repeat(2 * 1024 * 1024),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
