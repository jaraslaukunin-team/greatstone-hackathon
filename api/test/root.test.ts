import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { testApp } from './helpers.js';

describe('корневая страница API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await testApp());
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('программам отдаёт JSON с названием, статусом и адресом проверки', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json()).toEqual({ service: 'picpac-api', status: 'ok', health: '/health' });
  });

  it('браузеру отдаёт страницу на русском со ссылкой на /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/', headers: { accept: 'text/html,application/xhtml+xml' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('picPac API');
    expect(res.body).toContain('href="/health"');
    expect(res.body).toContain('lang="ru"');
  });

  it('страница не раскрывает внутренние детали: ни окружения, ни секретов, ни версий', async () => {
    const res = await app.inject({ method: 'GET', url: '/', headers: { accept: 'text/html' } });
    for (const leak of ['postgres', 'JWT', 'secret', 'process.env', 'node_modules']) {
      expect(res.body.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });

  it('несуществующий адрес по-прежнему даёт 404 в общем формате', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
