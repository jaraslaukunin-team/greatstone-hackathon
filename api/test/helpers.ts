import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { closeDb, createDb, type Db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { seedDatabase, type SeedSummary } from '../src/db/seed.js';

// Тестовые константы, не настоящие секреты.
export const testOverrides: Partial<Config> = {
  databaseUrl:
    process.env.DATABASE_URL_TEST ?? 'postgres://picpac:picpac@localhost:5433/picpac_test',
  jwtSecret: 'test-jwt-secret',
  fileUrlSecret: 'test-file-url-secret',
  uploadDir: './uploads-test',
};

const tableNames = (Object.values(schema) as unknown[])
  .filter((v): v is PgTable => is(v, PgTable))
  .map((t) => `"${getTableName(t)}"`);

// Очищает все таблицы и сбрасывает счётчики (в том числе order_number_seq).
export async function resetDatabase(db: Db): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${tableNames.join(', ')} RESTART IDENTITY CASCADE`));
  await db.execute(sql`ALTER SEQUENCE order_number_seq RESTART WITH 1`);
}

export function seed(db: Db): Promise<SeedSummary> {
  return seedDatabase(db);
}

export async function testApp(): Promise<{
  app: FastifyInstance;
  db: Db;
  reset(): Promise<void>;
}> {
  const app = await buildApp(testOverrides);
  const db = createDb(app.config.databaseUrl);
  app.addHook('onClose', async () => {
    await closeDb(db);
  });
  return { app, db, reset: () => resetDatabase(db) };
}
