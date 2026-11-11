import { runMigrations } from '../src/db/migrate.js';

// Один раз за запуск применяет миграции к тестовой базе.
export default async function setup(): Promise<void> {
  await runMigrations(
    process.env.DATABASE_URL_TEST ?? 'postgres://picpac:picpac@localhost:5433/picpac_test',
  );
}
