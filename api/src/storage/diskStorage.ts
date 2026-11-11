import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Storage } from './storage.js';

export class DiskStorage implements Storage {
  private readonly root: string;

  constructor(dir: string) {
    this.root = resolve(dir);
  }

  // Ключ не должен выводить путь за корневую папку (../, абсолютные пути).
  private path(key: string): string {
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root + sep)) throw new Error(`Недопустимый ключ хранилища: ${key}`);
    return p;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const p = this.path(key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }
}
