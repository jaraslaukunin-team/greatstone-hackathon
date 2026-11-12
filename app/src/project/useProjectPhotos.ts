import type { PhotoDTO } from '@picpac/shared';
import { useEffect, useMemo, useState } from 'react';
import type { ApiClient } from '../api/client';
import { projectSource, type SourceOf } from '../book/imageSource';

/** Фото проекта: карта по id, список и источник картинок для PageView. Грузится один раз при открытии экрана. */
export function useProjectPhotos(client: ApiClient, projectId: string | undefined) {
  const [photoMap, setPhotoMap] = useState<Map<string, PhotoDTO>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    client
      .get<PhotoDTO[]>(`/projects/${projectId}/photos`)
      .then((photos) => {
        if (!cancelled) setPhotoMap(new Map(photos.map((p) => [p.id, p])));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, projectId]);

  const sourceOf: SourceOf = useMemo(() => projectSource(photoMap, client.resolveUrl), [photoMap, client.resolveUrl]);
  const photoList = useMemo(() => Array.from(photoMap.values()), [photoMap]);
  const addPhoto = (photo: PhotoDTO) => setPhotoMap((m) => new Map(m).set(photo.id, photo));
  return { photoMap, photoList, sourceOf, loading, addPhoto };
}
