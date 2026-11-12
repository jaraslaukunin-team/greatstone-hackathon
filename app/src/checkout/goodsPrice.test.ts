import type { QuoteResponse } from '@picpac/shared';
import { goodsPriceKop } from './goodsPrice';

const quote = (over: Partial<QuoteResponse>): QuoteResponse => ({
  itemsKop: 10000,
  deliveryKop: 690,
  discountKop: 0,
  totalKop: 10690,
  currency: 'BYN',
  promoApplied: false,
  ...over,
});

describe('goodsPriceKop', () => {
  it('цена товара без доставки: итог минус доставка', () => {
    expect(goodsPriceKop(quote({}))).toBe(10000);
  });
  it('учитывает скидку по промокоду, но не доставку', () => {
    expect(goodsPriceKop(quote({ itemsKop: 20000, discountKop: 2000, deliveryKop: 0, totalKop: 18000 }))).toBe(18000);
  });
  it('не зависит от платной или бесплатной доставки', () => {
    expect(goodsPriceKop(quote({ deliveryKop: 0, totalKop: 10000 }))).toBe(goodsPriceKop(quote({ deliveryKop: 2090, totalKop: 12090 })));
  });
});
