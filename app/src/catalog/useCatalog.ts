import type { CatalogDTO, QuoteResponse } from '@picpac/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useApiClient } from '../api/hooks';
import { ApiRequestError, NetworkError } from '../api/client';

export function useCatalog() {
  const client = useApiClient();
  return useQuery({
    queryKey: ['catalog'],
    queryFn: () => client.get<CatalogDTO>('/catalog'),
  });
}

export function useVariantPrice(variantId: string | null, pages: number, quantity = 1) {
  const client = useApiClient();
  const [data, setData] = useState<QuoteResponse | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastOk = useRef<QuoteResponse | null>(null);

  useEffect(() => {
    if (!variantId) return;
    let cancelled = false;
    (async () => {
      try {
        const quote = await client.post<QuoteResponse>('/price-quote', {
          variantId,
          pages,
          quantity,
          delivery: 'belpost',
        });
        if (cancelled) return;
        lastOk.current = quote;
        setData(quote);
        setStale(false);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof NetworkError && lastOk.current) {
          setData(lastOk.current);
          setStale(true);
          setError(null);
          return;
        }
        setError(e instanceof ApiRequestError ? e.message : 'Не удалось получить цену');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, variantId, pages, quantity]);

  return { data, stale, error };
}
