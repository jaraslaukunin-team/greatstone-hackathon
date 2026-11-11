import { NetworkError } from '../api/client';

type Quote = {
  itemsKop: number;
  discountKop: number;
  deliveryKop: number;
  totalKop: number;
  currency: 'BYN';
  promoApplied: boolean;
};

async function fetchVariantPrice(
  post: (path: string, body: unknown) => Promise<Quote>,
  cache: { current: Quote | null },
  variantId: string,
  pages: number,
): Promise<{ data: Quote; stale: boolean }> {
  try {
    const quote = await post('/price-quote', {
      variantId,
      pages,
      quantity: 1,
      delivery: 'belpost',
    });
    cache.current = quote;
    return { data: quote, stale: false };
  } catch (e) {
    if (e instanceof NetworkError && cache.current) {
      return { data: cache.current, stale: true };
    }
    throw e;
  }
}

describe('useVariantPrice logic', () => {
  it('вызывает price-quote и отдаёт totalKop', async () => {
    const quote: Quote = {
      itemsKop: 8100,
      discountKop: 0,
      deliveryKop: 690,
      totalKop: 8790,
      currency: 'BYN',
      promoApplied: false,
    };
    const post = jest.fn(async () => quote);
    const cache = { current: null as Quote | null };
    const result = await fetchVariantPrice(post, cache, '00000000-0000-4000-8000-000000000101', 20);
    expect(post).toHaveBeenCalled();
    expect(result.data.totalKop).toBe(8790);
    expect(result.stale).toBe(false);
  });

  it('при ошибке сети возвращает последнее удачное значение с флагом stale', async () => {
    const quote: Quote = {
      itemsKop: 8100,
      discountKop: 0,
      deliveryKop: 690,
      totalKop: 8790,
      currency: 'BYN',
      promoApplied: false,
    };
    const cache = { current: quote };
    const post = jest.fn(async () => {
      throw new NetworkError();
    });
    const result = await fetchVariantPrice(post, cache, '00000000-0000-4000-8000-000000000101', 20);
    expect(result.data.totalKop).toBe(8790);
    expect(result.stale).toBe(true);
  });
});
