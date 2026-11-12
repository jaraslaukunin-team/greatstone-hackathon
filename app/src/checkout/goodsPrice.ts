import type { QuoteResponse } from '@picpac/shared';

/**
 * Цена товара со скидкой, без доставки. Ответ /price-quote всегда содержит доставку выбранного способа,
 * а до оформления её показывать нельзя: итог с доставкой виден только на экране подтверждения.
 */
export function goodsPriceKop(quote: Pick<QuoteResponse, 'itemsKop' | 'discountKop'>): number {
  return quote.itemsKop - quote.discountKop;
}
