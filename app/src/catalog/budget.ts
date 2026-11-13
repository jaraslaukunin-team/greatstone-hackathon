import type { ProductDTO, QuoteRequest, QuoteResponse, VariantDTO } from '@picpac/shared';
import type { ApiClient } from '../api/client';
import { goodsPriceKop } from '../checkout/goodsPrice';

export type BudgetOption = {
  productId: string;
  productTitle: string;
  variantId: string;
  format: string;
  pages: number;
  priceKop: number;
};

export function parseBudgetKop(value: string): number | null {
  const match = /^(\d+)(?:[,.](\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;

  const kop = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(kop) && kop > 0 ? kop : null;
}

export function selectedBookPages(value: string | undefined, variant: VariantDTO): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;

  const pages = Number(value);
  if (pages < variant.pagesMin || pages > variant.pagesMax) return undefined;
  if (pages === variant.pagesMax || (pages - variant.pagesMin) % 2 === 0) return pages;
  return undefined;
}

async function quoteBookWithinBudget(
  client: Pick<ApiClient, 'post'>,
  product: ProductDTO,
  variant: VariantDTO,
  budgetKop: number,
): Promise<BudgetOption | null> {
  async function quote(pages: number): Promise<BudgetOption> {
    const request: QuoteRequest = { variantId: variant.id, pages, quantity: 1, delivery: 'belpost' };
    const response = await client.post<QuoteResponse>('/price-quote', request);
    return {
      productId: product.id,
      productTitle: product.title,
      variantId: variant.id,
      format: variant.format,
      pages,
      priceKop: goodsPriceKop(response),
    };
  }

  const min = await quote(variant.pagesMin);
  if (min.priceKop > budgetKop) return null;
  if (variant.pagesMin === variant.pagesMax) return min;
  const max = await quote(variant.pagesMax);
  if (max.priceKop <= budgetKop) return max;

  // The server's goods price is monotonic in page count. Search the catalog screen's two-page steps.
  let best = min;
  let low = 1;
  let high = Math.floor((variant.pagesMax - variant.pagesMin - 1) / 2);
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const option = await quote(variant.pagesMin + mid * 2);
    if (option.priceKop <= budgetKop) {
      best = option;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

export async function findBudgetOptions(
  client: Pick<ApiClient, 'post'>,
  products: ProductDTO[],
  budgetKop: number,
): Promise<BudgetOption[]> {
  const books = products.filter((product) => product.kind === 'photobook');
  const options = await Promise.all(
    books.flatMap((product) =>
      product.variants.map((variant) => quoteBookWithinBudget(client, product, variant, budgetKop)),
    ),
  );
  return options
    .filter((option): option is BudgetOption => option !== null)
    .sort((a, b) => a.priceKop - b.priceKop);
}
