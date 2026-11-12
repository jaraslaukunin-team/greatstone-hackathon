import { Platform } from 'react-native';

/** Нативный драйвер анимаций есть не на вебе: там RN Web предупреждает в консоли. */
export const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Пауза между карточками списка при появлении, мс. */
export const STAGGER_MS = 70;
/** Верхняя граница задержки, чтобы длинный список не «доезжал» секунду. */
export const MAX_DELAY_MS = 420;

/** Задержка появления элемента списка с номером index. */
export function staggerDelay(index: number): number {
  return Math.min(MAX_DELAY_MS, Math.max(0, index) * STAGGER_MS);
}
