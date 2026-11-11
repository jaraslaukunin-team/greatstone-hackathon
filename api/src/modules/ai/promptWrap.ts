import type { AiEditKind } from '@picpac/shared';

const FACE_GUARD =
  'Сохрани лицо, черты и узнаваемость человека на фото. Не меняй личность. Измени только окружение, фон, одежду или стиль по инструкции пользователя.';

const UPSCALE =
  'Увеличь детализацию и резкость изображения, сохрани лицо и композицию без изменений сцены.';

/** Нормализует пользовательский prompt перед отправкой в image-edit модель. */
export function wrapEditPrompt(userPrompt: string, kind: AiEditKind = 'edit'): string {
  const cleaned = userPrompt.trim().replace(/\s+/g, ' ');
  if (kind === 'upscale') {
    return `${UPSCALE} Дополнительно: ${cleaned}`;
  }
  return `${FACE_GUARD} Запрос пользователя: ${cleaned}`;
}
