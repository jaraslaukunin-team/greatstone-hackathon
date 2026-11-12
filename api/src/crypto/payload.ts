import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

export type EncryptedBlobV1 = {
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

export function parsePayloadMasterKey(raw: string | undefined): Buffer | undefined {
  if (!raw?.trim()) return undefined;
  const trimmed = raw.trim();
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) key = Buffer.from(trimmed, 'hex');
  else key = Buffer.from(trimmed, 'base64');
  if (key.length !== KEY_LEN) {
    throw new Error(`PAYLOAD_ENCRYPTION_KEY должен быть 32 байта (64 hex или base64), сейчас ${key.length}`);
  }
  return key;
}

/** Пер-пользовательский ключ: HKDF-подобный HMAC(master, userId). */
export function deriveUserPayloadKey(master: Buffer, userId: string): Buffer {
  return createHmac('sha256', master).update(`picpac-payload-v1|${userId}`).digest();
}

export function encryptAesGcm(key: Buffer, plaintext: Buffer): EncryptedBlobV1 {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  };
}

export function decryptAesGcm(key: Buffer, blob: EncryptedBlobV1): Buffer {
  if (blob.v !== 1) throw new Error('Неизвестная версия конверта');
  const iv = Buffer.from(blob.iv, 'base64');
  const tag = Buffer.from(blob.tag, 'base64');
  const data = Buffer.from(blob.data, 'base64');
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) throw new Error('Повреждённый конверт');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

export function isEncryptedBlobV1(value: unknown): value is EncryptedBlobV1 {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return o.v === 1 && typeof o.iv === 'string' && typeof o.tag === 'string' && typeof o.data === 'string';
}

export function sha256Hex(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
