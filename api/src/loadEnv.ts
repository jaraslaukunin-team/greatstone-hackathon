import { fileURLToPath } from 'node:url';

/** Читает корневой `.env` репозитория, если файл есть (локальный запуск без export). */
export function loadRepoEnv(): void {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
  } catch {
    // нет файла — переменные уже в окружении (Docker/VPS)
  }
}
