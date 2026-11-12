import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  decryptAesGcm,
  deriveUserPayloadKey,
  encryptAesGcm,
  parsePayloadMasterKey,
} from '../src/crypto/payload.js';
import { seed, testApp } from './helpers.js';

const MASTER = 'cd'.repeat(32);

describe('envelope клиент↔API', () => {
  let app: FastifyInstance;
  let reset: () => Promise<void>;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    ({ app, reset } = await testApp({ payloadEncryptionKey: MASTER }));
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await reset();
    await seed(app.db);
    const contact = '+375291000001';
    await app.inject({ method: 'POST', url: '/auth/request-code', payload: { contact } });
    const login = await app.inject({
      method: 'POST',
      url: '/auth/verify-code',
      payload: { contact, code: '000000' },
    });
    expect(login.statusCode).toBe(200);
    const body = login.json() as { token: string; user: { id: string } };
    token = body.token;
    userId = body.user.id;
  });

  it('GET /crypto/client-key отдаёт AES-ключ пользователя', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/crypto/client-key',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { alg: string; v: number; key: string };
    expect(body).toMatchObject({ alg: 'AES-256-GCM', v: 1 });
    const master = parsePayloadMasterKey(MASTER)!;
    const expected = deriveUserPayloadKey(master, userId).toString('base64');
    expect(body.key).toBe(expected);
  });

  it('POST /ai/chat принимает зашифрованное тело', async () => {
    await app.inject({
      method: 'POST',
      url: '/ai/consent',
      headers: { authorization: `Bearer ${token}` },
    });
    const master = parsePayloadMasterKey(MASTER)!;
    const key = deriveUserPayloadKey(master, userId);
    const plain = Buffer.from(
      JSON.stringify({ messages: [{ role: 'user', content: 'Какие услуги в каталоге?' }] }),
      'utf8',
    );
    const blob = encryptAesGcm(key, plain);
    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: blob,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().reply).toMatch(/каталог|фотокниг|печат/i);
  });

  it('чужой ключ не расшифровывает тело', async () => {
    const master = parsePayloadMasterKey(MASTER)!;
    const wrong = deriveUserPayloadKey(master, 'other-user');
    const blob = encryptAesGcm(wrong, Buffer.from('{"messages":[]}'));
    const res = await app.inject({
      method: 'POST',
      url: '/ai/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: blob,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('DECRYPT_FAILED');
  });

  it('round-trip encrypt/decrypt совпадает с клиентским форматом', () => {
    const master = parsePayloadMasterKey(MASTER)!;
    const key = deriveUserPayloadKey(master, userId);
    const blob = encryptAesGcm(key, Buffer.from('pic'));
    expect(decryptAesGcm(key, blob).toString()).toBe('pic');
  });
});

describe('без PAYLOAD_ENCRYPTION_KEY', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    ({ app } = await testApp({ payloadEncryptionKey: undefined }));
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /crypto/client-key → 503 CRYPTO_DISABLED', async () => {
    const contact = '+375291000099';
    await app.inject({ method: 'POST', url: '/auth/request-code', payload: { contact } });
    const login = await app.inject({
      method: 'POST',
      url: '/auth/verify-code',
      payload: { contact, code: '000000' },
    });
    const token = (login.json() as { token: string }).token;
    const res = await app.inject({
      method: 'GET',
      url: '/crypto/client-key',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('CRYPTO_DISABLED');
  });
});
