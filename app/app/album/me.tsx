import {
  httpsUrlSchema,
  type AlbumProgressDTO,
  type PhotoDTO,
  type UpdateMyMemberRequest,
} from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiRequestError } from '../../src/api/client';
import { useApiClient } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

const WISH_MAX = 120;

/** «Мой разворот»: превью фото, пожелание и ссылка на видео → QR на странице фотокниги. */
export default function MyWishScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const client = useApiClient();
  const { user } = useAuth();
  const [childName, setChildName] = useState('');
  const [wish, setWish] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!projectId || !user) return;
    void Promise.all([
      client.get<AlbumProgressDTO>(`/projects/${projectId}/progress`),
      client.get<PhotoDTO[]>(`/projects/${projectId}/photos`),
    ])
      .then(([progress, photoList]) => {
        const me = progress.members.find((m) => m.userId === user.id);
        if (me) {
          setChildName(me.childName ?? '');
          setWish(me.wish ?? '');
          setVideoUrl(me.videoUrl ?? '');
        }
        setPhotos(photoList);
        setLoadError(false);
        setLoaded(true);
      })
      // Не удалось загрузить сохранённое: форму не открываем, иначе «Сохранить» перезапишет пожелание пустым.
      .catch(() => setLoadError(true));
  }, [client, projectId, user, attempt]);

  async function save() {
    const url = videoUrl.trim();
    if (url && !httpsUrlSchema.safeParse(url).success) {
      setError('Ссылка на видео должна начинаться с https://');
      return;
    }
    if (!childName.trim()) {
      setError('Укажите имя ученика');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const body: UpdateMyMemberRequest = { childName: childName.trim(), wish: wish.trim(), videoUrl: url || null };
      await client.patch(`/projects/${projectId}/members/me`, body);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Мой разворот</Text>
      <Text style={styles.sub}>
        Пожелание попадёт на ваш разворот в выпускной фотокниге, а ссылка на видео станет QR-кодом на странице.
      </Text>

      {photos.length > 0 ? (
        <View style={styles.preview}>
          <Text style={styles.label}>Ваши фото · {photos.length}</Text>
          <View style={styles.grid}>
            {photos.map((p) => (
              <Image key={p.id} source={{ uri: client.resolveUrl(p.url) }} style={styles.thumb} />
            ))}
          </View>
        </View>
      ) : null}

      <Text style={styles.label}>Имя ученика</Text>
      <Input value={childName} onChangeText={setChildName} placeholder="Имя и фамилия" maxLength={100} editable={loaded} />

      <Text style={styles.label}>Пожелание классу</Text>
      <Input
        value={wish}
        onChangeText={(t) => setWish(t.slice(0, WISH_MAX))}
        placeholder="Что хотите сказать одноклассникам"
        multiline
        style={styles.wish}
        editable={loaded}
      />
      <Text style={styles.hint}>
        {wish.length} / {WISH_MAX}
      </Text>

      <Text style={styles.label}>Ссылка на видео-поздравление (необязательно)</Text>
      <Input
        value={videoUrl}
        onChangeText={setVideoUrl}
        placeholder="https://"
        autoCapitalize="none"
        keyboardType="url"
        editable={loaded}
      />

      {loadError ? (
        <>
          <Text style={styles.error}>Не удалось загрузить ваши данные. Проверьте соединение.</Text>
          <Button title="Повторить" variant="secondary" onPress={() => setAttempt((n) => n + 1)} />
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button title="Сохранить" onPress={() => void save()} disabled={busy || !loaded || loadError} />
        <Button title="Позже" variant="secondary" onPress={() => router.replace('/(tabs)')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[2] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary, marginBottom: space[2] },
  preview: { gap: space[2], marginBottom: space[2] },
  label: { ...typography.bodyStrong, color: lightColors.text, marginTop: space[2] },
  hint: { ...typography.caption, color: lightColors.textSecondary, textAlign: 'right' },
  error: { ...typography.caption, color: lightColors.danger },
  wish: { minHeight: 96, textAlignVertical: 'top' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  thumb: { width: 76, height: 76, borderRadius: radius.photo, backgroundColor: lightColors.border },
  actions: { gap: space[2], marginTop: space[3] },
});
