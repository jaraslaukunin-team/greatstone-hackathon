import type { PhotoDTO, ProjectDTO } from '@picpac/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { doneRoute } from '../../../src/album/doneRoute';
import { useApiClient } from '../../../src/api/hooks';
import { useAuth } from '../../../src/auth/AuthProvider';
import { pickPhotos } from '../../../src/photos/pickPhotos';
import { UploadQueue } from '../../../src/photos/UploadQueue';
import { Button } from '../../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../../src/theme/theme';

export default function PhotosScreen() {
  const { id, albumMember } = useLocalSearchParams<{ id: string; albumMember?: string }>();
  const client = useApiClient();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isAlbumMember = albumMember === '1';

  const queue = useMemo(
    () =>
      new UploadQueue({
        storage: AsyncStorage,
        isOnline: () => true,
        upload: async (task) => {
          const photo = await client.upload<PhotoDTO>(`/projects/${task.projectId}/photos`, { uri: task.uri });
          setPhotos((list) => (list.some((p) => p.id === photo.id) ? list : [...list, photo]));
          return photo;
        },
      }),
    [client],
  );

  useEffect(() => {
    void client
      .get<ProjectDTO>(`/projects/${id}`)
      .then(setProject)
      .catch(() => undefined);
  }, [client, id]);

  useEffect(() => {
    // Фото, загруженные раньше, показываем сразу: можно вернуться на этот экран и добавить ещё.
    void client
      .get<PhotoDTO[]>(`/projects/${id}/photos`)
      .then((list) =>
        setPhotos((current) => [...list, ...current.filter((c) => !list.some((p) => p.id === c.id))]),
      )
      .catch(() => undefined);
  }, [client, id]);

  useEffect(() => {
    const off = queue.onChange((state) => {
      setPending(state.items.filter((i) => i.status === 'queued' || i.status === 'uploading').length);
      setFailed(state.items.filter((i) => i.status === 'error').length);
      setError(state.items.find((i) => i.status === 'error')?.error ?? null);
    });
    void queue.hydrate();
    return off;
  }, [queue]);

  async function onPick() {
    setError(null);
    try {
      const picked = await pickPhotos(isAlbumMember ? { selectionLimit: Math.max(0, 8 - photos.length) } : {});
      if (isAlbumMember && photos.length + picked.length > 8) {
        setError('Для выпускного альбома можно выбрать не больше 8 фото');
        return;
      }
      for (const photo of picked) {
        queue.enqueue({ localId: photo.localId, projectId: String(id), uri: photo.uri });
      }
      await queue.resume();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выбрать фото');
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{isAlbumMember ? 'Выпускной альбом' : 'Выберите фото'}</Text>
      <Text style={styles.sub}>{isAlbumMember ? 'Выберите 2–8 фото для своего разворота' : 'Лучше всего получаются книги из 30–60 фото'}</Text>
      <Text style={styles.progress}>
        {isAlbumMember ? 'Выбрано' : 'В книге'}: {photos.length}
        {pending > 0 ? ` · загружается ещё ${pending}` : ''}
        {failed > 0 ? ` · не удалось загрузить ${failed}` : ''}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {photos.length > 0 ? (
        <View style={styles.grid}>
          {photos.map((p) => (
            <Image key={p.id} source={{ uri: client.resolveUrl(p.url) }} style={styles.thumb} />
          ))}
        </View>
      ) : null}
      <Button title={isAlbumMember ? 'Выбрать фото' : 'Выбрать из галереи'} disabled={isAlbumMember && photos.length >= 8} onPress={() => void onPick()} />
      <Button
        title={isAlbumMember ? 'Перейти к оформлению разворота' : `Готово · ${photos.length} фото`}
        variant="secondary"
        disabled={pending > 0 || (isAlbumMember ? photos.length < 2 || photos.length > 8 : photos.length === 0)}
        onPress={() =>
          router.replace(
            (isAlbumMember ? `/album/me?projectId=${id}` : doneRoute(project, user?.id) ?? `/project/${id}/overview`) as Href,
          )
        }
      />
      {isAlbumMember && photos.length < 2 ? <Text style={styles.sub}>Добавьте ещё {2 - photos.length} фото, чтобы продолжить</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  progress: { ...typography.bodyStrong, color: lightColors.text },
  error: { ...typography.caption, color: lightColors.danger },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  thumb: { width: 76, height: 76, borderRadius: radius.photo, backgroundColor: lightColors.border },
});
