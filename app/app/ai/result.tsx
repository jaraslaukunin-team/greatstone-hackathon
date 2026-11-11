import { router, useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAiJob } from '../../src/ai/useAiJob';
import { Button } from '../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

const STATUS: Record<string, string> = {
  idle: 'Ожидание',
  pending: 'Обрабатываем фото, это займёт несколько секунд…',
  done: 'Готово',
  failed: 'Не получилось',
};

export default function AiResultScreen() {
  const { jobId, sourceUrl } = useLocalSearchParams<{ jobId: string; sourceUrl?: string }>();
  const client = useApiClient();
  const job = useAiJob(client, jobId ?? null);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>До и После</Text>
      <Text style={styles.sub}>{STATUS[job.status] ?? job.status}</Text>
      {job.reason ? <Text style={styles.error}>{job.reason}</Text> : null}
      <View style={styles.row}>
        {sourceUrl ? (
          <View style={styles.half}>
            <Text style={styles.caption}>До</Text>
            <Image source={{ uri: client.resolveUrl(String(sourceUrl)) }} style={styles.img} resizeMode="cover" />
          </View>
        ) : null}
        {job.result?.url ? (
          <View style={styles.half}>
            <Text style={styles.caption}>После</Text>
            <Image source={{ uri: client.resolveUrl(job.result.url) }} style={styles.img} resizeMode="cover" />
          </View>
        ) : null}
      </View>
      {job.status === 'pending' ? (
        <Button title="Отменить" variant="secondary" onPress={() => job.cancel()} />
      ) : null}
      {job.status === 'done' ? (
        <>
          <Button title="Напечатать" onPress={() => router.push('/catalog/prints')} />
          <Button title="Обработать ещё раз" variant="secondary" onPress={() => router.replace('/ai/edit')} />
          <Button title="К ассистенту" variant="text" onPress={() => router.push('/(tabs)/assistant')} />
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
  error: { ...typography.caption, color: lightColors.danger },
  row: { flexDirection: 'row', gap: space[2] },
  half: { flex: 1, gap: space[1] },
  caption: { ...typography.bodyStrong, color: lightColors.text },
  img: { width: '100%', aspectRatio: 1, borderRadius: radius.card, backgroundColor: lightColors.border },
});
