import { runMigrations } from '../src/db/migrate.js';
import { assertTestDatabaseUrl, TEST_DATABASE_URL } from './testDbGuard.js';

// Один раз за запуск применяет миграции к тестовой базе.
export default async function setup(): Promise<void> {
  assertTestDatabaseUrl(TEST_DATABASE_URL);
  await runMigrations(TEST_DATABASE_URL);
}
