import type { ProductDTO, QuoteRequest, QuoteResponse, VariantDTO } from '@picpac/shared';
import type { ApiClient } from '../api/client';
import { findBudgetOptions, parseBudgetKop, selectedBookPages } from './budget';

function variant(id: string, pagesMin = 20, pagesMax = 40): VariantDTO {
  return {
    id,
    productId: 'book',
    format: id,
    pagesMin,
    pagesMax,
    basePriceKop: 990000,
    pricePerPageKop: 99000,
    pageWidthCm: 20,
    minDpi: 150,
    leadTimeDays: 5,
  };
}

function product(variants: VariantDTO[], kind: ProductDTO['kind'] = 'photobook'): ProductDTO {
  return { id: 'book', title: 'Книга', description: '', kind, line: null, variants };
}

function quoteClient(price: (req: QuoteRequest) => number): {
  client: Pick<ApiClient, 'post'>;
  post: jest.Mock;
} {
  const post = jest.fn(async (_path: string, req: QuoteRequest): Promise<QuoteResponse> => {
    const itemsKop = price(req);
    const deliveryKop = 600;
    return { itemsKop, discountKop: 0, deliveryKop, totalKop: itemsKop + deliveryKop, currency: 'BYN', promoApplied: false };
  });
  const client: Pick<ApiClient, 'post'> = {
    post: async <T>(path: string, body?: unknown) => (await post(path, body as QuoteRequest)) as T,
  };
  return { client, post };
}

describe('parseBudgetKop', () => {
  it.each([
    ['60', 6000],
    [' 60,03 ', 6003],
    ['1.2', 120],
    ['0.01', 1],
  ])('конвертирует %s BYN в целые копейки', (raw, kop) => {
    expect(parseBudgetKop(raw)).toBe(kop);
  });

  it.each(['', '0', '-60', '60,001', '6e1', '10000000000000000'])('отклоняет %s', (raw) => {
    expect(parseBudgetKop(raw)).toBeNull();
  });
});

describe('selectedBookPages', () => {
  it('принимает шаг в две страницы и верхний предел', () => {
    expect(selectedBookPages('22', variant('lite', 20, 25))).toBe(22);
    expect(selectedBookPages('25', variant('lite', 20, 25))).toBe(25);
  });

  it('отклоняет шаги и значения вне каталога', () => {
    expect(selectedBookPages('23', variant('lite', 20, 25))).toBeUndefined();
    expect(selectedBookPages('26', variant('lite', 20, 25))).toBeUndefined();
    expect(selectedBookPages('21.5', variant('lite', 20, 25))).toBeUndefined();
  });
});

describe('findBudgetOptions', () => {
  it('ищет по котировкам API, включает цену ровно на границе и исключает доставку', async () => {
    const { client, post } = quoteClient(({ pages }) => 6000 + (pages - 20) * 100);
    const result = await findBudgetOptions(client, [product([variant('lite')])], 6400);

    expect(result).toEqual([
      { productId: 'book', productTitle: 'Книга', variantId: 'lite', format: 'lite', pages: 24, priceKop: 6400 },
    ]);
    expect(post).toHaveBeenCalledWith('/price-quote', { variantId: 'lite', pages: 24, quantity: 1, delivery: 'belpost' });
    expect(post.mock.calls.length).toBeLessThan(11);
  });

  it('возвращает верхний предел, если он укладывается, и запрашивает одно значение для фиксированного формата', async () => {
    const { client, post } = quoteClient(({ pages }) => pages * 100);
    const result = await findBudgetOptions(client, [product([variant('odd', 20, 25), variant('fixed', 22, 22)])], 3000);

    expect(result.map(({ variantId, pages }) => ({ variantId, pages }))).toEqual([
      { variantId: 'fixed', pages: 22 },
      { variantId: 'odd', pages: 25 },
    ]);
    expect(post.mock.calls.filter(([, req]) => req.variantId === 'fixed')).toHaveLength(1);
  });

  it('возвращает пустую выдачу, если самые короткие книги дороже лимита', async () => {
    const { client, post } = quoteClient(() => 6500);
    const result = await findBudgetOptions(client, [product([variant('classic')])], 6000);

    expect(result).toEqual([]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('пропускает печать и выпускные альбомы с отдельными сценариями оформления', async () => {
    const { client, post } = quoteClient(() => 100);
    const result = await findBudgetOptions(client, [product([variant('print')], 'prints'), product([variant('grad')], 'graduation')], 6000);

    expect(result).toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  it('передаёт ошибку запроса, чтобы экран мог предложить повторить поиск', async () => {
    const { client } = quoteClient(() => {
      throw new Error('Нет соединения');
    });
    await expect(findBudgetOptions(client, [product([variant('lite')])], 7000)).rejects.toThrow('Нет соединения');
  });
});
