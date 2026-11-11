import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema> & { $pool: pg.Pool };

// Пул создаётся лениво: pg.Pool не подключается, пока нет первого запроса.
export function createDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url });
  // Ошибки простаивающих соединений не должны ронять процесс.
  pool.on('error', () => {});
  return Object.assign(drizzle(pool, { schema }), { $pool: pool });
}

export async function closeDb(db: Db): Promise<void> {
  await db.$pool.end();
}
