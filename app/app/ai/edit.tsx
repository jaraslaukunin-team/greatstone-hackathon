import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { ApiRequestError } from '../../src/api/client';
import { startAiEdit } from '../../src/ai/useAiJob';
import { useProjectStore } from '../../src/project/projectStore';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function AiEditScreen() {
  const params = useLocalSearchParams<{ photoId?: string; projectId?: string }>();
  const client = useApiClient();
  const draft = useProjectStore((s) => s.draft);
  const projectId = params.projectId ?? draft?.project.id;
  const photoId = params.photoId;
  const [prompt, setPrompt] = useState('Тёплая ретро-плёнка');
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<{ jobId: string }> | null>(null);

  async function submit() {
    setError(null);
    if (!projectId || !photoId) {
      setError('Не выбраны проект или фото — откройте вкладку AI');
      return;
    }
    try {
      await client.post('/ai/consent', { consent: true });
      const { jobId } = await startAiEdit(
        client,
        { projectId, photoId, prompt, kind: 'edit' },
        inFlight,
      );
      router.push({ pathname: '/ai/result', params: { jobId } });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось запустить AI');
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>AI-редактор</Text>
      <Input multiline value={prompt} onChangeText={setPrompt} placeholder="Что изменить?" />
      <View style={styles.row}>
        {['Ретро', 'На море', 'Студийный свет'].map((preset) => (
          <Button key={preset} title={preset} variant="secondary" onPress={() => setPrompt(preset)} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Обработать" onPress={() => void submit()} />
      <Button title="Открыть ассистента" variant="text" onPress={() => router.push('/(tabs)/assistant')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  row: { gap: space[2] },
  error: { ...typography.caption, color: lightColors.danger },
});
