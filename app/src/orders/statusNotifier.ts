import type { OrderStatus } from '@picpac/shared';
import { statusLabel } from './statusLabel';

export type StatusNotifyDeps = {
  /** Из settingsStore.notifications; по умолчанию считаем включёнными. */
  enabled?: boolean;
  /** Показ тоста (веб и запасной вариант). */
  showToast: (message: string) => void;
  /** Локальное уведомление на нативе, если доступно. */
  scheduleLocal?: (title: string, body: string) => void | Promise<void>;
  /** true — только тост, без локальных уведомлений. */
  preferToast?: boolean;
};

/**
 * Сообщает о смене статуса заказа: тост на вебе, локальное уведомление на устройстве.
 * Первый полученный статус (prev === null) не шумит.
 */
export function notifyStatusChange(
  prev: OrderStatus | null,
  next: OrderStatus,
  deps: StatusNotifyDeps,
): void {
  if (deps.enabled === false) return;
  if (prev === null || prev === next) return;

  const body = `Статус заказа: ${statusLabel(next)}`;
  if (deps.preferToast || !deps.scheduleLocal) {
    deps.showToast(body);
    return;
  }
  void Promise.resolve(deps.scheduleLocal('PicPac', body)).catch(() => {
    deps.showToast(body);
  });
}
