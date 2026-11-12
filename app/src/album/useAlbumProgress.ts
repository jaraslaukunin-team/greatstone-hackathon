import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/client';

export type AlbumProgress = {
  expected: number | null;
  members: Array<{
    userId: string;
    childName: string | null;
    photosCount: number;
    wish?: string | null;
    videoUrl?: string | null;
    displayName?: string | null;
  }>;
};

export function useAlbumProgress(client: ApiClient, albumId: string | null) {
  const [progress, setProgress] = useState<AlbumProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!albumId) {
      setProgress(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const next = await client.get<AlbumProgress>(`/projects/${albumId}/progress`);
        if (!cancelled) {
          setProgress(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      }
    };
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [albumId, client]);

  return { progress, error };
}
