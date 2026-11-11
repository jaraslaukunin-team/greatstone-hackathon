import type { AiJobDTO } from '@picpac/shared';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { startAiEdit } from '../../src/ai/useAiJob';
import { ApiRequestError } from '../../src/api/client';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function AiEditScreen() {
  const client = useApiClient();
  const [prompt, setPrompt] = useState('Тёплая ретро-плёнка');
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<AiJobDTO> | null>(null);

  async function submit() {
    setError(null);
    try {
      const job = await startAiEdit(
        client,
        { photoId: '00000000-0000-4000-8000-000000000701', prompt },
        inFlight,
      );
      router.push({ pathname: '/ai/result', params: { jobId: job.id } });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось запустить AI');
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>AI-редактор</Text>
      <Input
        multiline
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Что изменить?"
      />
      <View style={styles.row}>
        {['Ретро', 'На море', 'Студийный свет'].map((preset) => (
          <Button key={preset} title={preset} variant="secondary" onPress={() => setPrompt(preset)} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Обработать" onPress={() => void submit()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  row: { gap: space[2] },
  error: { ...typography.caption, color: lightColors.danger },
});
