import type { OrderDTO, OrderStatus } from '@picpac/shared';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { ApiClient } from '../api/client';
import { useSettingsStore } from '../settings/settingsStore';
import { showToast } from '../ui/Toast';
import { notifyStatusChange } from './statusNotifier';

type Options = {
  client: ApiClient;
  orderId: string | null;
  intervalMs?: number;
  enabled?: boolean;
};

async function scheduleLocalNotification(title: string, body: string): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null,
    });
  } catch {
    showToast(body);
  }
}

export function useOrderPolling({ client, orderId, intervalMs = 5000, enabled = true }: Options) {
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatus = useRef<OrderStatus | null>(null);
  const notifications = useSettingsStore((s) => s.notifications);

  useEffect(() => {
    if (!orderId || !enabled) return;

    let cancelled = false;
    prevStatus.current = null;

    const tick = async () => {
      try {
        const next = await client.get<OrderDTO>(`/orders/${orderId}`);
        if (cancelled) return;
        notifyStatusChange(prevStatus.current, next.status, {
          enabled: notifications,
          showToast,
          scheduleLocal: scheduleLocalNotification,
          preferToast: Platform.OS === 'web',
        });
        prevStatus.current = next.status;
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
  }, [client, orderId, intervalMs, enabled, notifications]);

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
