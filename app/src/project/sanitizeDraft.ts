/**
 * Черновик хранится на устройстве и переживает обновления приложения. Версия с прежней ошибкой могла
 * сохранить в нём не проект, а только {version}: такой черновик ломает корзину и оформление.
 * Возвращает черновик, если он целый, иначе null.
 */
export function sanitizeDraft<T>(raw: unknown): T | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as { project?: { id?: unknown; variantId?: unknown }; layout?: { pages?: unknown } };
  const ok =
    typeof d.project?.id === 'string' &&
    typeof d.project.variantId === 'string' &&
    Array.isArray(d.layout?.pages);
  return ok ? (raw as T) : null;
}
