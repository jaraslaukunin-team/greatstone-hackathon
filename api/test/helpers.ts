import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { closeDb, createDb, type Db } from '../src/db/client.js';

// Тестовые константы, не настоящие секреты.
export const testConfig: Config = {
  databaseUrl:
    process.env.DATABASE_URL_TEST ?? 'postgres://picpac:picpac@localhost:5433/picpac_test',
  jwtSecret: 'test-jwt-secret',
  fileUrlSecret: 'test-file-url-secret',
  uploadDir: './uploads-test',
  demoMode: false,
  aiProvider: 'stub',
  aiaiBaseUrl: 'https://api.aiai.by/v1',
  aiaiApiKey: '',
  aiaiModel: '',
  aiaiEditMode: 'images',
  port: 0,
};

export async function testApp(): Promise<{
  app: FastifyInstance;
  db: Db;
  reset(): Promise<void>;
}> {
  const app = await buildApp(testConfig, { logger: false });
  const db = createDb(testConfig.databaseUrl);
  app.addHook('onClose', async () => {
    await closeDb(db);
  });
  // Очистка таблиц появится в задаче A2.
  return { app, db, reset: async () => {} };
}
