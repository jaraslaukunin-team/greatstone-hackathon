import type { OrderStatus } from '@picpac/shared';

export type OrderStatusTone = {
  backgroundColor: string;
  borderColor: string;
  statusColor: string;
};

const TONES: Record<OrderStatus, OrderStatusTone> = {
  accepted: {
    backgroundColor: '#F0EEEC',
    borderColor: '#CCC7BF',
    statusColor: '#5C5F5E',
  },
  moderation: {
    backgroundColor: '#EEE8FA',
    borderColor: '#BAA8DD',
    statusColor: '#5B3C8C',
  },
  production: {
    backgroundColor: '#FFF4CC',
    borderColor: '#E6C84A',
    statusColor: '#765900',
  },
  ready_for_delivery: {
    backgroundColor: '#E3F0FB',
    borderColor: '#7EB6E0',
    statusColor: '#1E5A8A',
  },
  completed: {
    backgroundColor: '#E2F0D9',
    borderColor: '#7AA45A',
    statusColor: '#3A6B28',
  },
  cancelled: {
    backgroundColor: '#F5E0DE',
    borderColor: '#D98984',
    statusColor: '#8B2E2A',
  },
};

const FALLBACK: OrderStatusTone = {
  backgroundColor: '#F0EEEC',
  borderColor: '#CCC7BF',
  statusColor: '#5C5F5E',
};

/** Цвета карточки и подписи статуса заказа. */
export function orderStatusTone(status: string | undefined): OrderStatusTone {
  if (!status) return FALLBACK;
  return TONES[status as OrderStatus] ?? FALLBACK;
}
