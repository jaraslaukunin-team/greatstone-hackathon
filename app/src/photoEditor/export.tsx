import { drawAsImage, ImageFormat, type SkImage, type SkTypeface } from '@shopify/react-native-skia';
import { EditScene } from './EditScene';
import type { EditState } from './editState';
import { exportSize } from './geometry';

export const EXPORT_QUALITY = 92;

/**
 * Готовое фото: сцена рисуется в офскрин-поверхность полного размера (длинная сторона до 4096 px)
 * и кодируется в JPEG. Оригинал не трогается: результат загружается в проект как новое фото.
 */
export async function exportEdited(
  image: SkImage,
  state: EditState,
  typeface: SkTypeface | null,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const { width, height } = exportSize(image.width(), image.height(), state.crop, state.rotation);
  const rendered = await drawAsImage(<EditScene image={image} state={state} width={width} height={height} typeface={typeface} />, {
    width,
    height,
  });
  if (!rendered) throw new Error('Не удалось нарисовать фото');
  return { bytes: rendered.encodeToBytes(ImageFormat.JPEG, EXPORT_QUALITY), width, height };
}
