import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { auditLog, consents, profiles } from '../src/db/schema.js';
import type { Db } from '../src/db/client.js';
import { deny, requireAuth, requireRole } from '../src/auth/plugin.js';
import { seed, testApp } from './helpers.js';

describe('вход, роли и журнал', () => {
  let app: FastifyInstance;
  let db: Db;
  let reset: () => Promise<void>;

  beforeAll(async () => {
    ({ app, db, reset } = await testApp());
    app.get('/t/operator', { preHandler: requireRole('operator') }, async () => ({ ok: true }));
    app.get('/t/deny', { preHandler: requireAuth }, async (req) => {
      await deny(req, 'project', 'abc');
    });
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => new Date();
  });

  const requestCode = (contact: string) =>
    app.inject({ method: 'POST', url: '/auth/request-code', payload: { contact } });
  const verify = (contact: string, code: string) =>
    app.inject({ method: 'POST', url: '/auth/verify-code', payload: { contact, code } });
  const login = async (contact: string) => {
    await requestCode(contact);
    return (await verify(contact, '000000')).json() as { token: string; user: { id: string; role: string } };
  };

  it('гость получает токен и isGuest: true, вход пишет auth.login', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/guest' });
    expect(res.statusCode).toBe(200);
    const { token, user } = res.json();
    expect(typeof token).toBe('string');
    expect(user.isGuest).toBe(true);
    expect(user.role).toBe('customer');
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, 'auth.login'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: user.id, objectType: 'profile', objectId: user.id, result: 'ok' });
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ id: user.id, isGuest: true, aiConsent: false });
  });

  it('запрос без токена к /me даёт 401 UNAUTHORIZED', async () => {
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
    const bad = await app.inject({ method: 'GET', url: '/me', headers: { authorization: 'Bearer junk' } });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error.code).toBe('UNAUTHORIZED');
  });

  it('request-code отвечает 204', async () => {
    const res = await requestCode('new@test.local');
    expect(res.statusCode).toBe(204);
  });

  it('неверный код даёт 401 CODE_INVALID, даже без запрошенного кода', async () => {
    await requestCode('new@test.local');
    const wrong = await verify('new@test.local', '123456');
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().error.code).toBe('CODE_INVALID');
    const none = await verify('other@test.local', '000000');
    expect(none.statusCode).toBe(401);
    expect(none.json().error.code).toBe('CODE_INVALID');
  });

  it('истёкший код даёт 401 CODE_EXPIRED', async () => {
    const t0 = new Date('2026-01-01T10:00:00Z');
    app.clock.now = () => t0;
    await requestCode('new@test.local');
    app.clock.now = () => new Date(t0.getTime() + 10 * 60 * 1000 + 1000);
    const res = await verify('new@test.local', '000000');
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('CODE_EXPIRED');
  });

  it('код действует до конца TTL и используется один раз', async () => {
    const t0 = new Date('2026-01-01T10:00:00Z');
    app.clock.now = () => t0;
    await requestCode('new@test.local');
    app.clock.now = () => new Date(t0.getTime() + 9 * 60 * 1000);
    expect((await verify('new@test.local', '000000')).statusCode).toBe(200);
    const again = await verify('new@test.local', '000000');
    expect(again.statusCode).toBe(401);
    expect(again.json().error.code).toBe('CODE_INVALID');
  });

  it('верный код создаёт клиента, повторный вход возвращает того же', async () => {
    await requestCode('Anna.Ivanova@test.local');
    const res = await verify('Anna.Ivanova@test.local', '000000');
    expect(res.statusCode).toBe(200);
    const { token, user } = res.json();
    expect(user).toMatchObject({ role: 'customer', isGuest: false, displayName: 'anna.ivanova', aiConsent: false });
    const again = await login('anna.ivanova@test.local');
    expect(again.user.id).toBe(user.id);
    const rows = await db.select().from(profiles).where(eq(profiles.contact, 'anna.ivanova@test.local'));
    expect(rows).toHaveLength(1);
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` } });
    expect(me.json().id).toBe(user.id);
    const logins = await db.select().from(auditLog).where(eq(auditLog.action, 'auth.login'));
    expect(logins).toHaveLength(2);
  });

  it('пустой или неверный контакт и код дают 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/request-code', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
    const res2 = await app.inject({ method: 'POST', url: '/auth/verify-code', payload: { contact: 'a@b.c' } });
    expect(res2.statusCode).toBe(400);
  });

  it('seeded-оператор входит как operator', async () => {
    const { user } = await login('operator@test.local');
    expect(user.role).toBe('operator');
  });

  it('aiConsent true, если есть согласие ai_processing', async () => {
    const { token, user } = await login('customer1@test.local');
    await db.insert(consents).values({ userId: user.id, kind: 'ai_processing' });
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` } });
    expect(me.json().aiConsent).toBe(true);
  });

  it('токен удалённого профиля даёт 401', async () => {
    const { token, user } = await login('gone@test.local');
    await db.delete(profiles).where(eq(profiles.id, user.id));
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` } });
    expect(me.statusCode).toBe(401);
    expect(me.json().error.code).toBe('UNAUTHORIZED');
  });

  it('токен просроченный по app.clock даёт 401', async () => {
    const { token } = await login('customer1@test.local');
    app.clock.now = () => new Date(Date.now() + 8 * 24 * 3600 * 1000);
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${token}` } });
    expect(me.statusCode).toBe(401);
  });

  it('requireRole(operator) для клиента даёт 403 и access.denied в журнале', async () => {
    const { token, user } = await login('customer1@test.local');
    const res = await app.inject({ method: 'GET', url: '/t/operator', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, 'access.denied'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: user.id, result: 'denied' });
    const op = await login('operator@test.local');
    const ok = await app.inject({ method: 'GET', url: '/t/operator', headers: { authorization: `Bearer ${op.token}` } });
    expect(ok.statusCode).toBe(200);
  });

  it('requireRole без токена даёт 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/t/operator' });
    expect(res.statusCode).toBe(401);
  });

  it('deny пишет access.denied и отвечает 404 NOT_FOUND', async () => {
    const { token, user } = await login('customer1@test.local');
    const res = await app.inject({ method: 'GET', url: '/t/deny', headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
    const rows = await db.select().from(auditLog).where(eq(auditLog.action, 'access.denied'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: user.id, objectType: 'project', objectId: 'abc', result: 'denied' });
  });
});

describe('вход вне демо-режима', () => {
  it('код случайный: 000000 не подходит', async () => {
    const { app, db, reset } = await testApp({ demoMode: false });
    try {
      await reset();
      await seed(db);
      const r = await app.inject({ method: 'POST', url: '/auth/request-code', payload: { contact: 'x@test.local' } });
      expect(r.statusCode).toBe(204);
      const res = await app.inject({
        method: 'POST',
        url: '/auth/verify-code',
        payload: { contact: 'x@test.local', code: '000000' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('CODE_INVALID');
    } finally {
      await app.close();
    }
  });
});
