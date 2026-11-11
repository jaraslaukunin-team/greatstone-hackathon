import type { FastifyInstance } from 'fastify';
import { DiskStorage } from './diskStorage.js';
import type { Storage } from './storage.js';

declare module 'fastify' {
  interface FastifyInstance {
    storage: Storage;
  }
}

export function registerStorage(app: FastifyInstance): void {
  app.decorate('storage', new DiskStorage(app.config.uploadDir));
}
