export type RoleMode = 'customer' | 'staff';
type Account = { role: 'customer' | 'operator' } | null;

/** Раздел сотрудника открыт только оператору и только если на входе выбрана роль сотрудника. Права на данные проверяет API. */
export function canEnterStaff(mode: RoleMode | null, user: Account): boolean {
  return mode === 'staff' && user?.role === 'operator';
}

/**
 * Куда вести после входа. Клиентский аккаунт, выбравший «сотрудник», идёт в раздел сотрудника:
 * там он увидит «нет доступа» с возвратом к входу клиента.
 */
export function homeFor(mode: RoleMode | null, user: Account): '/(tabs)' | '/(staff)' | '/(auth)/role' {
  if (!user) return '/(auth)/role';
  return mode === 'staff' ? '/(staff)' : '/(tabs)';
}
