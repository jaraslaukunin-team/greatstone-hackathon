import { Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAiJob } from '../../src/ai/useAiJob';
import { Button } from '../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

export default function AiResultScreen() {
  const { jobId, sourceUrl } = useLocalSearchParams<{ jobId: string; sourceUrl?: string }>();
  const client = useApiClient();
  const job = useAiJob(client, jobId ?? null);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>До и После</Text>
      <Text style={styles.sub}>Статус: {job.status}</Text>
      {job.reason ? <Text style={styles.error}>{job.reason}</Text> : null}
      <View style={styles.row}>
        {sourceUrl ? (
          <View style={styles.half}>
            <Text style={styles.caption}>До</Text>
            <Image source={{ uri: String(sourceUrl) }} style={styles.img} />
          </View>
        ) : null}
        {job.result?.url ? (
          <View style={styles.half}>
            <Text style={styles.caption}>После</Text>
            <Image source={{ uri: job.result.url }} style={styles.img} />
          </View>
        ) : null}
      </View>
      {job.status === 'pending' ? (
        <Button title="Отменить" variant="secondary" onPress={() => job.cancel()} />
      ) : null}
      {job.status === 'done' ? (
        <>
          <Button title="В книгу" onPress={() => router.push('/(tabs)/designs')} />
          <Button title="Напечатать" variant="secondary" onPress={() => router.push('/catalog/prints')} />
          <Button title="К ассистенту" variant="text" onPress={() => router.push('/(tabs)/assistant')} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  error: { ...typography.caption, color: lightColors.danger },
  row: { flexDirection: 'row', gap: space[2] },
  half: { flex: 1, gap: space[1] },
  caption: { ...typography.caption, color: lightColors.textMuted },
  img: { width: '100%', height: 180, borderRadius: radius.card, backgroundColor: lightColors.canvas },
});
