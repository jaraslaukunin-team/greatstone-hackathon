import type { OrderDTO } from '@picpac/shared';
import { useEffect, useRef, useState } from 'react';
import type { ApiClient } from '../api/client';

type Options = {
  client: ApiClient;
  orderId: string | null;
  intervalMs?: number;
  enabled?: boolean;
};

export function useOrderPolling({ client, orderId, intervalMs = 5000, enabled = true }: Options) {
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!orderId || !enabled) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const next = await client.get<OrderDTO>(`/orders/${orderId}`);
        if (cancelled) return;
        setOrder(next);
        setError(null);
        if (next.status === 'completed' || next.status === 'cancelled') {
          if (timer.current) clearInterval(timer.current);
          timer.current = null;
        }
      } catch {
        if (!cancelled) setError('Не удалось обновить статус');
      }
    };

    void tick();
    timer.current = setInterval(() => void tick(), intervalMs);

    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [client, orderId, intervalMs, enabled]);

  return { order, error };
}

export function createOrderPoller(deps: {
  getOrder: () => Promise<OrderDTO>;
  intervalMs?: number;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}) {
  const intervalMs = deps.intervalMs ?? 5000;
  const setIntervalFn = deps.setIntervalFn ?? setInterval;
  const clearIntervalFn = deps.clearIntervalFn ?? clearInterval;
  let timer: ReturnType<typeof setInterval> | null = null;
  let last: OrderDTO | null = null;
  const listeners = new Set<(order: OrderDTO) => void>();

  async function tick() {
    try {
      const order = await deps.getOrder();
      last = order;
      for (const listener of listeners) listener(order);
      if (order.status === 'completed' || order.status === 'cancelled') {
        stop();
      }
    } catch {
      // keep polling on network errors
    }
  }

  function start() {
    void tick();
    timer = setIntervalFn(() => void tick(), intervalMs);
  }

  function stop() {
    if (timer) clearIntervalFn(timer);
    timer = null;
  }

  return {
    start,
    stop,
    onChange(cb: (order: OrderDTO) => void) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getLast: () => last,
  };
}
