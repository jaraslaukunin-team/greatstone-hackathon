import { describe, expect, it } from 'vitest';
import {
  decryptAesGcm,
  deriveUserPayloadKey,
  encryptAesGcm,
  parsePayloadMasterKey,
} from '../src/crypto/payload.js';
import { sanitizeForExternalLlm } from '../src/modules/ai/sanitize.js';

const MASTER_HEX = '01'.repeat(32);

describe('payload crypto', () => {
  it('шифрует и расшифровывает AES-GCM с ключом пользователя', () => {
    const master = parsePayloadMasterKey(MASTER_HEX)!;
    const key = deriveUserPayloadKey(master, 'user-1');
    const plain = Buffer.from(JSON.stringify({ hello: 'мир' }), 'utf8');
    const blob = encryptAesGcm(key, plain);
    expect(blob.v).toBe(1);
    expect(decryptAesGcm(key, blob).toString('utf8')).toBe(plain.toString('utf8'));
    const other = deriveUserPayloadKey(master, 'user-2');
    expect(() => decryptAesGcm(other, blob)).toThrow();
  });

  it('отклоняет ключ неверной длины', () => {
    expect(() => parsePayloadMasterKey('abcd')).toThrow(/32 байта/);
  });
});

describe('sanitizeForExternalLlm', () => {
  it('маскирует email, телефон и индекс', () => {
    const out = sanitizeForExternalLlm('Пишите на a@b.by или +375 29 111-22-33, индекс 220000');
    expect(out).not.toMatch(/a@b\.by/);
    expect(out).toContain('[contact]');
    expect(out).toContain('[phone]');
    expect(out).toContain('[index]');
  });
});
