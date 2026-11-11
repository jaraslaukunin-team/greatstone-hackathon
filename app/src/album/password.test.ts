import { passwordProblem } from './password';

describe('passwordProblem', () => {
  it('принимает пароль от 4 до 64 символов', () => {
    expect(passwordProblem('abcd')).toBeNull();
    expect(passwordProblem('x'.repeat(64))).toBeNull();
  });
  it('отклоняет короткий и длинный', () => {
    expect(passwordProblem('abc')).toMatch(/не короче 4/);
    expect(passwordProblem('x'.repeat(65))).toMatch(/не длиннее 64/);
  });
  it('пробелы по краям считаются символами пароля', () => {
    expect(passwordProblem('  a ')).toBeNull();
    expect(passwordProblem('   ')).toMatch(/не короче/);
  });
});
