import type { CreateOrderRequest, OrderDTO, QuoteResponse } from '@picpac/shared';
import { useCallback, useRef, useState } from 'react';
import { ApiRequestError, NetworkError, type ApiClient } from '../api/client';
import { ensureIdempotencyKey } from './idempotency';
import type { ProjectDraft } from '../project/projectStore';

type Options = {
  client: ApiClient;
  draft: ProjectDraft;
  setIdempotencyKey: (key: string | null) => void;
  delivery: CreateOrderRequest['delivery'];
  promoCode?: string;
  address?: CreateOrderRequest['address'];
  pages: number;
};

export function createCheckoutController(opts: Options) {
  let submitting = false;
  let lastQuote: QuoteResponse | null = null;

  return {
    ensureKey() {
      return ensureIdempotencyKey(opts.draft, (key) => opts.setIdempotencyKey(key));
    },
    async quote(): Promise<QuoteResponse> {
      const quote = await opts.client.post<QuoteResponse>('/price-quote', {
        variantId: opts.draft.project.variantId,
        pages: opts.pages,
        quantity: 1,
        delivery: opts.delivery,
        promoCode: opts.promoCode,
      });
      lastQuote = quote;
      return quote;
    },
    async submit(): Promise<OrderDTO> {
      if (submitting) {
        throw new Error('Уже отправляется');
      }
      submitting = true;
      try {
        const key = ensureIdempotencyKey(opts.draft, (k) => opts.setIdempotencyKey(k));
        const quote = lastQuote ?? (await this.quote());
        try {
          const order = await opts.client.post<OrderDTO>(
            '/orders',
            {
              projectId: opts.draft.project.id,
              delivery: opts.delivery,
              promoCode: opts.promoCode,
              expectedTotalKop: quote.totalKop,
              address: opts.address,
            },
            { 'Idempotency-Key': key },
          );
          opts.setIdempotencyKey(null);
          return order;
        } catch (e) {
          if (e instanceof ApiRequestError && e.code === 'PRICE_CHANGED') {
            lastQuote = await this.quote();
            throw e;
          }
          if (e instanceof NetworkError) {
            throw e;
          }
          throw e;
        }
      } finally {
        submitting = false;
      }
    },
  };
}

export function useCheckout(opts: Options) {
  const controllerRef = useRef(createCheckoutController(opts));
  controllerRef.current = createCheckoutController(opts);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async () => {
    setError(null);
    try {
      return await controllerRef.current.submit();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка оформления');
      throw e;
    }
  }, []);

  return {
    ensureIdempotencyKey: () => controllerRef.current.ensureKey(),
    quote: () => controllerRef.current.quote(),
    submit,
    error,
  };
}
