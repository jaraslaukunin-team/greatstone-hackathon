import type { PhotoDTO } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAiJob } from '../../src/ai/useAiJob';
import { useEditResult } from '../../src/photoEditor/editResultStore';
import { BeforeAfterSlider } from '../../src/ui/BeforeAfterSlider';
import { Button } from '../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

export default function AiResultScreen() {
  const { jobId, sourceUrl, projectId, requestId, returnTo } = useLocalSearchParams<{
    jobId: string;
    sourceUrl?: string;
    projectId?: string;
    requestId?: string;
    returnTo?: string;
  }>();
  const client = useApiClient();
  const job = useAiJob(client, jobId ?? null);
  const before = sourceUrl ? client.resolveUrl(String(sourceUrl)) : null;
  const result = job.status === 'done' ? job.result : undefined;
  const backToPrint = returnTo === 'print' && typeof requestId === 'string' && requestId.length > 0;

  function print() {
    if (!result) return;
    router.push({ pathname: '/print/format', params: { photoId: result.id, sourceProjectId: projectId ?? '' } });
  }

  function applyToPrint() {
    if (!result || !backToPrint) return;
    useEditResult.getState().set(String(requestId), result as PhotoDTO);
    // frames → consent → edit → result: закрываем три экрана, frames остаётся в стеке.
    if (typeof router.dismiss === 'function') {
      router.dismiss(3);
      return;
    }
    router.back();
    router.back();
    router.back();
  }

  function anotherPrompt() {
    const next: Record<string, string> = {};
    if (typeof projectId === 'string' && projectId) next.projectId = projectId;
    if (result) {
      next.photoId = result.id;
      next.photoUrl = result.url;
    } else if (typeof sourceUrl === 'string' && sourceUrl) {
      // fallback: остаёмся на исходном кадре
    }
    if (typeof requestId === 'string' && requestId) next.requestId = requestId;
    if (typeof returnTo === 'string' && returnTo) next.returnTo = returnTo;
    router.replace({ pathname: '/ai/edit', params: next });
  }

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
          {backToPrint ? (
            <Button title="Применить к печати" onPress={applyToPrint} />
          ) : (
            <Button title="Напечатать это фото" onPress={print} disabled={!projectId} />
          )}
          <Button title="Написать ещё один промпт" variant="secondary" onPress={anotherPrompt} />
          <Button title="Назад" variant="text" onPress={() => router.back()} />
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
