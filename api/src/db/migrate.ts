import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { loadRepoEnv } from '../loadEnv.js';
import { closeDb, createDb } from './client.js';

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export async function runMigrations(databaseUrl: string): Promise<void> {
  const db = createDb(databaseUrl);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await closeDb(db);
  }
}

// Запуск из командной строки: npm run db:migrate -w api
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  loadRepoEnv();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Не задана переменная окружения DATABASE_URL');
  await runMigrations(url);
  console.log('Миграции применены');
}
