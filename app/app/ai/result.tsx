import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAiJob } from '../../src/ai/useAiJob';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function AiResultScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const client = useApiClient();
  const job = useAiJob(client, jobId ?? null);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Результат</Text>
      <Text style={styles.sub}>Статус: {job.status}</Text>
      {job.reason ? <Text style={styles.error}>{job.reason}</Text> : null}
      {job.status === 'pending' ? (
        <Button title="Отменить" variant="secondary" onPress={() => job.cancel()} />
      ) : null}
      {job.status === 'done' ? (
        <>
          <Text style={styles.sub}>До и После готовы</Text>
          <Button title="В книгу" onPress={() => router.push('/(tabs)/designs')} />
          <Button title="Напечатать" variant="secondary" onPress={() => router.push('/catalog/prints')} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textMuted },
  error: { ...typography.caption, color: lightColors.danger },
});
