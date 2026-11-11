import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DiskStorage, parseFileEncryptionKey } from '../src/storage/diskStorage.js';

describe('DiskStorage AES-GCM', () => {
  let dir = '';

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = '';
  });

  it('parseFileEncryptionKey принимает 64 hex', () => {
    const hex = 'a'.repeat(64);
    expect(parseFileEncryptionKey(hex)?.length).toBe(32);
    expect(parseFileEncryptionKey(undefined)).toBeUndefined();
    expect(() => parseFileEncryptionKey('short')).toThrow(/FILE_ENCRYPTION_KEY/);
  });

  it('без ключа пишет plaintext', async () => {
    dir = await mkdtemp(join(tmpdir(), 'picpac-plain-'));
    const store = new DiskStorage(dir);
    const data = Buffer.from('hello-photo');
    await store.put('a/b.jpg', data);
    expect(await readFile(join(dir, 'a', 'b.jpg'))).toEqual(data);
    expect(await store.get('a/b.jpg')).toEqual(data);
  });

  it('с ключом шифрует на диске и расшифровывает при get; читает legacy plaintext', async () => {
    dir = await mkdtemp(join(tmpdir(), 'picpac-enc-'));
    const key = 'b'.repeat(64);
    const store = new DiskStorage(dir, key);
    const data = Buffer.from('secret-bytes-42');
    await store.put('x/y.jpg', data);
    const onDisk = await readFile(join(dir, 'x', 'y.jpg'));
    expect(onDisk.subarray(0, 8).toString('utf8')).toBe('picpac1\0');
    expect(onDisk.equals(data)).toBe(false);
    expect(await store.get('x/y.jpg')).toEqual(data);

    const plainPath = join(dir, 'legacy.jpg');
    const { writeFile } = await import('node:fs/promises');
    await writeFile(plainPath, Buffer.from('old-plain'));
    expect(await store.get('legacy.jpg')).toEqual(Buffer.from('old-plain'));
  });
});
