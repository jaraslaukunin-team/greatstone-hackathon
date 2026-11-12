import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAiJob } from '../../src/ai/useAiJob';
import { useEditResult } from '../../src/photoEditor/editResultStore';
import { BeforeAfterSlider } from '../../src/ui/BeforeAfterSlider';
import { Button } from '../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

export default function AiResultScreen() {
  const { jobId, sourceUrl, projectId } = useLocalSearchParams<{
    jobId: string;
    sourceUrl?: string;
    projectId?: string;
  }>();
  const client = useApiClient();
  const job = useAiJob(client, jobId ?? null);
  const before = sourceUrl ? client.resolveUrl(String(sourceUrl)) : null;
  const result = job.status === 'done' ? job.result : undefined;

  function print() {
    if (!result) return;
    router.push({ pathname: '/print/format', params: { photoId: result.id, sourceProjectId: projectId ?? '' } });
  }

  // «Доработать»: фоторедактор, а сохранённое фото сразу уходит в печать. Само AI-фото остаётся как есть.
  const pendingEdit = useRef<string | null>(null);
  const editResults = useEditResult((s) => s.results);
  function refine() {
    if (!result || !projectId) return;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingEdit.current = requestId;
    router.push({ pathname: '/photo-editor', params: { projectId: String(projectId), photoId: result.id, requestId } });
  }
  useEffect(() => {
    const requestId = pendingEdit.current;
    if (!requestId || !editResults[requestId]) return;
    const photo = useEditResult.getState().take(requestId);
    pendingEdit.current = null;
    if (photo) router.push({ pathname: '/print/format', params: { photoId: photo.id, sourceProjectId: projectId ?? '' } });
  }, [editResults, projectId]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>До и После</Text>
      {job.status === 'pending' ? (
        <View>
          {before ? <Image source={{ uri: before }} style={styles.waiting} resizeMode="contain" /> : null}
          <View style={styles.overlay}>
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text style={styles.overlayText}>Обрабатываем фото, это займёт несколько секунд…</Text>
          </View>
        </View>
      ) : null}
      {job.status === 'failed' ? <Text style={styles.error}>{job.reason ?? 'Не получилось обработать фото'}</Text> : null}
      {result ? (
        before ? (
          <BeforeAfterSlider
            beforeUri={before}
            afterUri={client.resolveUrl(result.url)}
            aspect={result.width / result.height}
          />
        ) : (
          <Image
            source={{ uri: client.resolveUrl(result.url) }}
            style={[styles.single, { aspectRatio: result.width / result.height }]}
            resizeMode="contain"
          />
        )
      ) : null}
      {job.status === 'pending' ? <Button title="Отменить" variant="secondary" onPress={() => job.cancel()} /> : null}
      {result ? (
        <>
          <Text style={styles.sub}>Потяните границу, чтобы сравнить. Результат уже сохранён в ваши фото.</Text>
          <Button title="Напечатать это фото" onPress={print} disabled={!projectId} />
          <Button title="Доработать" variant="secondary" onPress={refine} disabled={!projectId} />
          <Button title="Обработать ещё раз" variant="secondary" onPress={() => router.replace('/ai/edit')} />
          <Button title="К редактору" variant="text" onPress={() => router.push('/(tabs)/editor')} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  error: { ...typography.body, color: lightColors.danger },
  waiting: { width: '100%', aspectRatio: 1, borderRadius: radius.card, backgroundColor: lightColors.border },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: radius.card,
  },
  overlayText: { ...typography.body, color: '#FFFFFF', textAlign: 'center', paddingHorizontal: space[4] },
  single: { width: '100%', borderRadius: radius.card, backgroundColor: lightColors.border },
});
