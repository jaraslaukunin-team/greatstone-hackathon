import type { OrderStatus } from '@picpac/shared';

export type OrderStatusTone = {
  backgroundColor: string;
  borderColor: string;
  statusColor: string;
};

const TONES: Record<OrderStatus, OrderStatusTone> = {
  accepted: {
    backgroundColor: '#E3F0FB',
    borderColor: '#7EB6E0',
    statusColor: '#1E5A8A',
  },
  moderation: {
    backgroundColor: '#FFF4CC',
    borderColor: '#E6C84A',
    statusColor: '#8A6D00',
  },
  production: {
    backgroundColor: '#FFE8D6',
    borderColor: '#E8996C',
    statusColor: '#9A4A1A',
  },
  ready_for_delivery: {
    backgroundColor: '#D9F0EA',
    borderColor: '#6BB8A8',
    statusColor: '#1F6B5C',
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
