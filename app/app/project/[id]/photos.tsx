import type { PhotoDTO } from '@picpac/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { pickPhotos } from '../../../src/photos/pickPhotos';
import { UploadQueue } from '../../../src/photos/UploadQueue';
import { Button } from '../../../src/ui/Button';
import { lightColors, space, typography } from '../../../src/theme/theme';

export default function PhotosScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const queue = useMemo(
    () =>
      new UploadQueue({
        storage: AsyncStorage,
        isOnline: () => true,
        upload: async (task) =>
          client.post<PhotoDTO>(`/projects/${task.projectId}/photos`, {
            localId: task.localId,
            uri: task.uri,
          }),
      }),
    [client],
  );

  useEffect(() => {
    const off = queue.onChange((state) => {
      setTotal(state.items.length);
      setDone(state.items.filter((i) => i.status === 'done').length);
      setError(state.items.find((i) => i.status === 'error')?.error ?? null);
    });
    void queue.hydrate();
    return off;
  }, [queue]);

  async function onPick() {
    setError(null);
    try {
      const photos = await pickPhotos();
      for (const photo of photos) {
        queue.enqueue({ localId: photo.localId, projectId: String(id), uri: photo.uri });
      }
      await queue.resume();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось выбрать фото');
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Выберите фото</Text>
      <Text style={styles.sub}>Для 20 страниц подойдут 30–60 фото</Text>
      <Text style={styles.progress}>
        Загружено {done} из {total || '—'}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Выбрать из галереи" onPress={() => void onPick()} />
      <Button
        title={`Готово · ${done} фото`}
        variant="secondary"
        disabled={done === 0}
        onPress={() => router.push(`/project/${id}/overview`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text, marginTop: space[5] },
  sub: { ...typography.body, color: lightColors.textMuted },
  progress: { ...typography.bodyStrong, color: lightColors.text },
  error: { ...typography.caption, color: lightColors.danger },
});
