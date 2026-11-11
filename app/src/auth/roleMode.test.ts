import { canEnterStaff, homeFor } from './roleMode';

const customer = { role: 'customer' as const };
const operator = { role: 'operator' as const };

describe('canEnterStaff', () => {
  it('пускает только оператора в режиме сотрудника', () => {
    expect(canEnterStaff('staff', operator)).toBe(true);
  });
  it('клиентский аккаунт в режиме сотрудника не проходит', () => {
    expect(canEnterStaff('staff', customer)).toBe(false);
  });
  it('оператор в режиме клиента или без выбора режима не попадает в раздел сотрудника', () => {
    expect(canEnterStaff('customer', operator)).toBe(false);
    expect(canEnterStaff(null, operator)).toBe(false);
  });
  it('без пользователя нельзя', () => {
    expect(canEnterStaff('staff', null)).toBe(false);
  });
});

describe('homeFor', () => {
  it('без входа ведёт на выбор роли', () => {
    expect(homeFor('customer', null)).toBe('/(auth)/role');
  });
  it('оператор в режиме сотрудника попадает в раздел сотрудника', () => {
    expect(homeFor('staff', operator)).toBe('/(staff)');
  });
  it('клиент и оператор в режиме клиента попадают в клиентскую часть', () => {
    expect(homeFor('customer', customer)).toBe('/(tabs)');
    expect(homeFor('customer', operator)).toBe('/(tabs)');
  });
  it('клиентский аккаунт в режиме сотрудника получает экран «нет доступа»', () => {
    expect(homeFor('staff', customer)).toBe('/(staff)');
  });
  it('без режима вошедший пользователь идёт в клиентскую часть', () => {
    expect(homeFor(null, customer)).toBe('/(tabs)');
  });
});
