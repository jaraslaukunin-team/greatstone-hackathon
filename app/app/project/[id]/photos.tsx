import type { PhotoDTO, ProjectDTO } from '@picpac/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { doneRoute } from '../../../src/album/doneRoute';
import { useApiClient } from '../../../src/api/hooks';
import { useAuth } from '../../../src/auth/AuthProvider';
import { pickPhotos } from '../../../src/photos/pickPhotos';
import { UploadQueue } from '../../../src/photos/UploadQueue';
import { Button } from '../../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../../src/theme/theme';

const GRAD_MIN = 2;
const GRAD_MAX = 8;

function isGraduation(project: ProjectDTO | null): boolean {
  return !!project?.isShared && !project.isPool;
}

export default function PhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const client = useApiClient();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const graduation = isGraduation(project);

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
    navigation.setOptions({ title: graduation ? 'Выпускной альбом' : 'Фотокнига' });
  }, [navigation, graduation]);

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
      const picked = await pickPhotos();
      const room = graduation ? Math.max(0, GRAD_MAX - photos.length) : picked.length;
      const toAdd = graduation ? picked.slice(0, room) : picked;
      if (graduation && picked.length > room) {
        setError(`Для разворота нужно не больше ${GRAD_MAX} фото`);
      }
      for (const photo of toAdd) {
        queue.enqueue({ localId: photo.localId, projectId: String(id), uri: photo.uri });
      }
      await queue.resume();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выбрать фото');
    }
  }

  const canDone = graduation
    ? photos.length >= GRAD_MIN && photos.length <= GRAD_MAX && pending === 0
    : photos.length > 0 && pending === 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{graduation ? 'Выпускной альбом' : 'Выберите фото'}</Text>
      <Text style={styles.sub}>
        {graduation ? 'Выберите 2–8 фото для своего разворота' : 'Лучше всего получаются книги из 30–60 фото'}
      </Text>
      <Text style={styles.progress}>
        {graduation ? `Выбрано: ${photos.length} из ${GRAD_MAX}` : `В книге: ${photos.length}`}
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
      <Button
        title="Выбрать из галереи"
        onPress={() => void onPick()}
        disabled={graduation && photos.length >= GRAD_MAX}
      />
      <Button
        title={`Готово · ${photos.length} фото`}
        variant="secondary"
        disabled={!canDone}
        onPress={() => router.replace(doneRoute(project, user?.id) ?? `/project/${id}/overview`)}
      />
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
