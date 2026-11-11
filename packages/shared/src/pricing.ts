import { DELIVERY_METHODS } from './delivery';
import type { Kopecks } from './money';
import type { DeliveryMethodId, VariantDTO } from './types';

export type PriceBreakdown = {
  itemsKop: Kopecks;
  discountKop: Kopecks;
  deliveryKop: Kopecks;
  totalKop: Kopecks;
};

export type CalcPriceInput = {
  variant: Pick<VariantDTO, 'basePriceKop' | 'pricePerPageKop' | 'pagesMin'>;
  pages: number;
  quantity: number;
  discountPercent: number;
  delivery: DeliveryMethodId;
};

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function calcPrice(input: CalcPriceInput): PriceBreakdown {
  const { variant, pages, quantity, discountPercent, delivery } = input;
  const unitKop = variant.basePriceKop + Math.max(0, pages - variant.pagesMin) * variant.pricePerPageKop;
  const itemsKop = unitKop * quantity;
  const discountKop = Math.round((itemsKop * discountPercent) / 100);
  const afterDiscountKop = itemsKop - discountKop;

  const method = DELIVERY_METHODS.find((m) => m.id === delivery);
  if (!method) throw new Error(`Неизвестный способ доставки: ${delivery}`);
  const isFree = method.freeFromKop !== null && afterDiscountKop >= method.freeFromKop;
  const deliveryKop = isFree ? 0 : method.priceKop;

  return { itemsKop, discountKop, deliveryKop, totalKop: afterDiscountKop + deliveryKop };
}
