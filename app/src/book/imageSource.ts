import type { PhotoDTO } from '@picpac/shared';
import type { ImageSourcePropType } from 'react-native';

/** Картинка для ячейки: источник и её размеры в пикселях (нужны, чтобы не растягивать фото). */
export type ImageInfo = { source: ImageSourcePropType; width: number; height: number };

/** Откуда страница берёт картинку по id фото. null — фото нет, рисуется пустая ячейка. */
export type SourceOf = (photoId: string) => ImageInfo | null;

/** Фото проекта: картинка по подписанному URL из API. */
export function projectSource(photos: Map<string, PhotoDTO>, resolveUrl: (path: string) => string): SourceOf {
  return (photoId) => {
    const photo = photos.get(photoId);
    if (!photo) return null;
    return { source: { uri: resolveUrl(photo.url) }, width: photo.width, height: photo.height };
  };
}
