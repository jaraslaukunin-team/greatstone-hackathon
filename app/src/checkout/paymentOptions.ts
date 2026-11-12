import type { DeliveryMethodId, PaymentMethod } from '@picpac/shared';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  card: 'Карта',
  erip: 'ЕРИП',
  courier: 'Курьеру при получении',
};

/**
 * Доступные методы оплаты для выбранного способа доставки.
 * «Курьеру при получении» — только для курьера по Минску.
 */
export function paymentOptions(delivery: DeliveryMethodId): PaymentMethod[] {
  const base: PaymentMethod[] = ['card', 'erip'];
  if (delivery === 'courier_minsk') {
    base.push('courier');
  }
  return base;
}
