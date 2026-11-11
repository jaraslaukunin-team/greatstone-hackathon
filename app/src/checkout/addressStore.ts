import type { CreateOrderRequest } from '@picpac/shared';
import { create } from 'zustand';

export type OrderAddress = NonNullable<CreateOrderRequest['address']>;

/** Адрес доставки живёт только в памяти приложения: в адрес страницы и на диск он не попадает. */
export const useAddressStore = create<{
  address: OrderAddress | null;
  setAddress(address: OrderAddress | null): void;
}>((set) => ({
  address: null,
  setAddress: (address) => set({ address }),
}));

/** Возвращает текст ошибки для первого незаполненного поля или null, если адрес годится. */
export function validateAddress(a: Partial<Record<keyof OrderAddress, string>>): string | null {
  if (!a.recipient?.trim()) return 'Укажите имя получателя';
  if (!a.phone?.trim() || a.phone.replace(/\D/g, '').length < 9) return 'Укажите телефон, например +375 29 123-45-67';
  if (!a.city?.trim()) return 'Укажите город';
  if (!a.street?.trim()) return 'Укажите улицу и дом';
  return null;
}
