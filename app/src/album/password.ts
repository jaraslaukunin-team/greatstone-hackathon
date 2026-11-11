export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 64;

/** Сообщение о проблеме с паролем альбома или null, если пароль годится. Пробелы по краям не обрезаются. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Пароль должен быть не короче ${PASSWORD_MIN} символов`;
  if (password.length > PASSWORD_MAX) return `Пароль должен быть не длиннее ${PASSWORD_MAX} символов`;
  return null;
}
