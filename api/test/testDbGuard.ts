// Защита от случайной очистки или миграции не той базы: тесты работают только с базой *_test.
export function assertTestDatabaseUrl(url: string): void {
  let name: string;
  try {
    name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('Адрес тестовой базы не разобран: проверьте DATABASE_URL_TEST');
  }
  if (!name.endsWith('_test')) {
    throw new Error(
      `Тесты запускаются только на базе с именем на _test, а получено "${name}": проверьте DATABASE_URL_TEST`,
    );
  }
}

export function assertTestDatabaseName(name: string): void {
  if (!name.endsWith('_test')) {
    throw new Error(`Очистка разрешена только для базы *_test, а подключена "${name}"`);
  }
}

export const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ?? 'postgres://picpac:picpac@localhost:5433/picpac_test';
