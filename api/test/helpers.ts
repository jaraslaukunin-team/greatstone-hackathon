import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import type { Db } from '../src/db/client.js';
import * as schema from '../src/db/schema.js';
import { seedDatabase, type SeedSummary } from '../src/db/seed.js';
import { assertTestDatabaseName, assertTestDatabaseUrl, TEST_DATABASE_URL } from './testDbGuard.js';

assertTestDatabaseUrl(TEST_DATABASE_URL);

// Загрузки тестов уходят во временную папку, а не в репозиторий.
export const TEST_UPLOAD_DIR = mkdtempSync(join(tmpdir(), 'picpac-uploads-'));

// Тестовые константы, не настоящие секреты.
export const testOverrides: Partial<Config> = {
  databaseUrl: TEST_DATABASE_URL,
  jwtSecret: 'test-jwt-secret',
  fileUrlSecret: 'test-file-url-secret',
  uploadDir: TEST_UPLOAD_DIR,
  demoMode: true,
};

const tableNames = (Object.values(schema) as unknown[])
  .filter((v): v is PgTable => is(v, PgTable))
  .map((t) => `"${getTableName(t)}"`);

// Очищает все таблицы и сбрасывает счётчики (в том числе order_number_seq).
export async function resetDatabase(db: Db): Promise<void> {
  // Проверяем реальную базу соединения, а не адрес из переменной окружения.
  const res = await db.execute(sql`SELECT current_database() AS name`);
  assertTestDatabaseName(String((res.rows[0] as { name: string }).name));
  await db.execute(sql.raw(`TRUNCATE ${tableNames.join(', ')} RESTART IDENTITY CASCADE`));
  await db.execute(sql`ALTER SEQUENCE order_number_seq RESTART WITH 1`);
}

export function seed(db: Db): Promise<SeedSummary> {
  return seedDatabase(db);
}

export async function testApp(extra: Partial<Config> = {}): Promise<{
  app: FastifyInstance;
  db: Db;
  reset(): Promise<void>;
}> {
  const app = await buildApp({ ...testOverrides, ...extra });
  const db = app.db;
  return { app, db, reset: () => resetDatabase(db) };
}
