import { validateAddress } from './addressStore';

describe('validateAddress', () => {
  const ok = { recipient: 'Анна', phone: '+375 29 123-45-67', city: 'Минск', street: 'пр. Независимости, 1' };
  it('принимает полный адрес', () => {
    expect(validateAddress(ok)).toBeNull();
  });
  it('просит недостающее поле', () => {
    expect(validateAddress({ ...ok, recipient: ' ' })).toMatch(/имя/);
    expect(validateAddress({ ...ok, phone: '12' })).toMatch(/телефон/);
    expect(validateAddress({ ...ok, city: '' })).toMatch(/город/);
    expect(validateAddress({ ...ok, street: '' })).toMatch(/улицу/);
  });
});
