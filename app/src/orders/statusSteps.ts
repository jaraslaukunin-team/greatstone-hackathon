import type { OrderStatus } from '@picpac/shared';
import { statusLabel } from './statusLabel';

/** Шаги ленты статусов (без «Отменён»). */
export const STATUS_FLOW: Exclude<OrderStatus, 'cancelled'>[] = [
  'accepted',
  'moderation',
  'production',
  'ready_for_delivery',
  'completed',
];

export type StatusStep = {
  status: OrderStatus;
  label: string;
  /** Уже пройден или текущий (включая завершённый). */
  reached: boolean;
  /** Именно этот шаг активен сейчас. */
  current: boolean;
};

/**
 * Лента статусов для экрана заказа.
 * При отмене все шаги неreached, current на первом — отдельная плашка снаружи.
 */
export function statusSteps(status: OrderStatus): StatusStep[] {
  if (status === 'cancelled') {
    return STATUS_FLOW.map((s) => ({
      status: s,
      label: statusLabel(s),
      reached: false,
      current: false,
    }));
  }
  const idx = STATUS_FLOW.indexOf(status);
  return STATUS_FLOW.map((s, i) => ({
    status: s,
    label: statusLabel(s),
    reached: i <= idx,
    current: i === idx,
  }));
}
