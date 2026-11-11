import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Storage } from './storage.js';

/** picpac1 + null — маркер AES-256-GCM файла на диске. */
const MAGIC = Buffer.from('picpac1\0', 'utf8');
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

export function parseFileEncryptionKey(raw: string | undefined): Buffer | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    key = Buffer.from(trimmed, 'hex');
  } else {
    key = Buffer.from(trimmed, 'base64');
  }
  if (key.length !== KEY_LEN) {
    throw new Error(`FILE_ENCRYPTION_KEY должен быть 32 байта (64 hex или base64), сейчас ${key.length}`);
  }
  return key;
}

export class DiskStorage implements Storage {
  private readonly root: string;
  private readonly key: Buffer | undefined;

  constructor(dir: string, fileEncryptionKey?: Buffer | string) {
    this.root = resolve(dir);
    this.key =
      typeof fileEncryptionKey === 'string' || fileEncryptionKey === undefined
        ? parseFileEncryptionKey(fileEncryptionKey)
        : fileEncryptionKey;
  }

  // Ключ не должен выводить путь за корневую папку (../, абсолютные пути).
  private path(key: string): string {
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root + sep)) throw new Error(`Недопустимый ключ хранилища: ${key}`);
    return p;
  }

  private encrypt(data: Buffer): Buffer {
    if (!this.key) return data;
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([MAGIC, iv, tag, enc]);
  }

  private decrypt(data: Buffer): Buffer {
    if (!data.subarray(0, MAGIC.length).equals(MAGIC)) {
      return data; // старые незашифрованные файлы
    }
    if (!this.key) {
      throw new Error('Файл зашифрован, задайте FILE_ENCRYPTION_KEY');
    }
    const iv = data.subarray(MAGIC.length, MAGIC.length + IV_LEN);
    const tag = data.subarray(MAGIC.length + IV_LEN, MAGIC.length + IV_LEN + TAG_LEN);
    const enc = data.subarray(MAGIC.length + IV_LEN + TAG_LEN);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
  }

  async put(key: string, data: Buffer): Promise<void> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, this.encrypt(data));
  }

  async get(key: string): Promise<Buffer> {
    return this.decrypt(await readFile(this.path(key)));
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}
