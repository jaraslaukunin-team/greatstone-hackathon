import { describe, expect, it } from 'vitest';
import { calcPrice, normalizePromoCode } from './pricing';

const variant = { basePriceKop: 8100, pricePerPageKop: 150, pagesMin: 20 };

describe('calcPrice', () => {
  it('минимум страниц, платная доставка Белпочтой', () => {
    expect(calcPrice({ variant, pages: 20, quantity: 1, discountPercent: 0, delivery: 'belpost' })).toEqual({
      itemsKop: 8100, discountKop: 0, deliveryKop: 690, totalKop: 8790,
    });
  });

  it('доплата за страницы, скидка и бесплатная доставка от порога', () => {
    expect(calcPrice({ variant, pages: 30, quantity: 2, discountPercent: 10, delivery: 'belpost' })).toEqual({
      itemsKop: 19200, discountKop: 1920, deliveryKop: 0, totalKop: 17280,
    });
  });

  it('EMS платная ниже порога', () => {
    expect(calcPrice({ variant, pages: 20, quantity: 1, discountPercent: 0, delivery: 'ems' }).totalKop).toBe(10190);
  });

  it('скидка округляется до целой копейки, курьер по Минску бесплатный', () => {
    expect(calcPrice({ variant, pages: 25, quantity: 1, discountPercent: 15, delivery: 'courier_minsk' })).toEqual({
      itemsKop: 8850, discountKop: 1328, deliveryKop: 0, totalKop: 7522,
    });
  });
});

describe('normalizePromoCode', () => {
  it('обрезает пробелы и приводит к верхнему регистру', () => {
    expect(normalizePromoCode('  hello10 ')).toBe('HELLO10');
  });
});
