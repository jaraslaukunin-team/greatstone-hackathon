import type { Kopecks } from './money';
import type { DeliveryMethodId } from './types';

export type DeliveryMethod = {
  id: DeliveryMethodId;
  title: string;
  priceKop: Kopecks;
  freeFromKop: Kopecks | null;
  etaDays: [number, number];
  payOnDelivery: boolean;
};

export const DELIVERY_METHODS: DeliveryMethod[] = [
  { id: 'courier_minsk', title: 'Курьер по Минску', priceKop: 0, freeFromKop: null, etaDays: [1, 2], payOnDelivery: true },
  { id: 'ems', title: 'EMS', priceKop: 2090, freeFromKop: 30000, etaDays: [2, 4], payOnDelivery: false },
  { id: 'belpost', title: 'Белпочта', priceKop: 690, freeFromKop: 15000, etaDays: [3, 7], payOnDelivery: false },
];
