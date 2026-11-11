import { describe, expect, it } from 'vitest';
import { assertTestDatabaseName, assertTestDatabaseUrl } from './testDbGuard.js';

describe('защита тестовой базы', () => {
  it('принимает базу picpac_test', () => {
    expect(() => assertTestDatabaseUrl('postgres://u:p@localhost:5433/picpac_test')).not.toThrow();
    expect(() => assertTestDatabaseName('picpac_test')).not.toThrow();
  });
  it('отклоняет рабочую базу, пустое имя и мусор', () => {
    expect(() => assertTestDatabaseUrl('postgres://u:p@localhost:5433/picpac')).toThrow(/_test/);
    expect(() => assertTestDatabaseUrl('postgres://u:p@localhost:5433')).toThrow(/_test/);
    expect(() => assertTestDatabaseUrl('postgres://u:p@localhost:5433/')).toThrow(/_test/);
    expect(() => assertTestDatabaseUrl('это не адрес')).toThrow(/не разобран/);
    expect(() => assertTestDatabaseName('picpac')).toThrow(/_test/);
  });
});
