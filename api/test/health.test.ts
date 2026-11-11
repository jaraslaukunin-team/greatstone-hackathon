import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { loadConfig } from '../src/config.js';
import { testApp } from './helpers.js';

describe('health', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    ({ app } = await testApp());
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /health отвечает 200 {status: ok}', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('ответы API несут заголовки безопасности и не кэшируются', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cache-control']).toBe('no-store');
    const missing = await app.inject({ method: 'GET', url: '/nope' });
    expect(missing.headers['x-content-type-options']).toBe('nosniff');
  });

  it('неизвестный путь даёт 404 в формате ApiErrorBody', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(typeof body.error.message).toBe('string');
  });
});

describe('loadConfig', () => {
  it('бросает ошибку с названием отсутствующей переменной', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: 'x', FILE_URL_SECRET: 'y' })).toThrow(/JWT_SECRET/);
  });

  it('применяет значения по умолчанию', () => {
    const c = loadConfig({ DATABASE_URL: 'd', JWT_SECRET: 'j', FILE_URL_SECRET: 'f' });
    expect(c).toMatchObject({
      databaseUrl: 'd', jwtSecret: 'j', fileUrlSecret: 'f', uploadDir: './uploads',
      demoMode: false, aiProvider: 'stub', aiaiBaseUrl: 'https://api.aiai.by/v1',
      aiaiApiKey: '', aiaiModel: 'qwen-image-edit', aiaiChatModel: 'gpt-4o-mini',
      aiaiEditMode: 'images', port: 3000,
    });
  });

  it('DEMO_MODE понимает true, 1, yes без учёта регистра', () => {
    const base = { DATABASE_URL: 'd', JWT_SECRET: 'j', FILE_URL_SECRET: 'f' };
    for (const v of ['true', '1', 'YES', 'True']) {
      expect(loadConfig({ ...base, DEMO_MODE: v }).demoMode).toBe(true);
    }
    for (const v of ['false', '0', '']) {
      expect(loadConfig({ ...base, DEMO_MODE: v }).demoMode).toBe(false);
    }
  });

  it('отклоняет недопустимый AIAI_EDIT_MODE', () => {
    expect(() =>
      loadConfig({ DATABASE_URL: 'd', JWT_SECRET: 'j', FILE_URL_SECRET: 'f', AIAI_EDIT_MODE: 'bad' }),
    ).toThrow(/AIAI_EDIT_MODE/);
  });
});
