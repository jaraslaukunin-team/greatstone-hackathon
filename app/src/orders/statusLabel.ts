import type { OrderStatus } from '@picpac/shared';

const LABELS: Record<OrderStatus, string> = {
  accepted: 'Принят',
  moderation: 'Проверяем макет',
  production: 'В печати',
  ready_for_delivery: 'Готов к отправке',
  completed: 'Выполнен',
  cancelled: 'Отменён',
};

/** Название статуса заказа для людей; неизвестный статус показываем как есть. */
export function statusLabel(status: string | undefined): string {
  if (!status) return '…';
  return LABELS[status as OrderStatus] ?? status;
}
