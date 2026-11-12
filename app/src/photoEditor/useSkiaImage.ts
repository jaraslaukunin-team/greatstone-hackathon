import { useImage, type SkImage } from '@shopify/react-native-skia';
import { useState } from 'react';

/** Картинка по адресу в виде SkImage; error — текст, если загрузить или раскодировать не удалось. */
export function useSkiaImage(uri: string | null): { image: SkImage | null; error: string | null } {
  const [error, setError] = useState<string | null>(null);
  const image = useImage(uri, (e) => setError(e.message || 'Не удалось открыть фото'));
  return { image, error };
}
