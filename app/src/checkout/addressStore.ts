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
export function validateAddress(
  a: Partial<Record<keyof OrderAddress, string>>,
  delivery?: import('@picpac/shared').DeliveryMethodId,
): string | null {
  if (!a.recipient?.trim()) return 'Укажите имя получателя';
  if (!a.phone?.trim() || a.phone.replace(/\D/g, '').length < 9) return 'Укажите телефон, например +375 29 123-45-67';
  if (!a.city?.trim()) return 'Укажите город';
  if (delivery === 'courier_minsk' && a.city?.trim().toLowerCase() !== 'минск') {
    return 'OUTSIDE_COURIER_ZONE';
  }
  if (!a.pickupPointId && !a.street?.trim()) return 'Укажите улицу и дом';
  return null;
}

/** Возвращает true, если ошибка означает выход за зону курьера. */
export function isOutsideCourierZone(error: string | null): boolean {
  return error === 'OUTSIDE_COURIER_ZONE';
}
