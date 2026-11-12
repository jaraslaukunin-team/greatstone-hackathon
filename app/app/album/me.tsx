import { httpsUrlSchema, type AlbumProgressDTO, type UpdateMyMemberRequest } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiRequestError } from '../../src/api/client';
import { useApiClient } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { lightColors, space, typography } from '../../src/theme/theme';

const WISH_MAX = 200;

/** «Моё пожелание»: имя ученика, пожелание классу и ссылка на видео; всё это печатается на его развороте альбома. */
export default function MyWishScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const client = useApiClient();
  const { user } = useAuth();
  const [childName, setChildName] = useState('');
  const [wish, setWish] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!projectId || !user) return;
    void client
      .get<AlbumProgressDTO>(`/projects/${projectId}/progress`)
      .then((p) => {
        const me = p.members.find((m) => m.userId === user.id);
        if (me) {
          setChildName(me.childName ?? '');
          setWish(me.wish ?? '');
          setVideoUrl(me.videoUrl ?? '');
        }
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [client, projectId, user]);

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
      <Text style={styles.title}>Моё пожелание</Text>
      <Text style={styles.sub}>Оно попадёт на ваш разворот в выпускном альбоме, а ссылка на видео станет QR-кодом на странице.</Text>

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

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Button title="Сохранить" onPress={() => void save()} disabled={busy || !loaded} />
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
  label: { ...typography.bodyStrong, color: lightColors.text, marginTop: space[2] },
  hint: { ...typography.caption, color: lightColors.textSecondary, textAlign: 'right' },
  error: { ...typography.caption, color: lightColors.danger },
  wish: { minHeight: 96, textAlignVertical: 'top' },
  actions: { gap: space[2], marginTop: space[3] },
});
