import { fileURLToPath } from 'node:url';

/** Подхватывает корневой `.env` репозитория (локальный запуск без ручного export). */
export function loadRepoEnv(): void {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
  } catch {
    // файла может не быть на CI / в Docker — переменные уже в process.env
  }
}
