import type { AiJobDTO } from '@picpac/shared';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { startAiEdit } from '../../src/ai/useAiJob';
import { ApiRequestError } from '../../src/api/client';
import { Button } from '../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

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
      <TextInput
        style={styles.input}
        value={prompt}
        onChangeText={setPrompt}
        placeholder="Что изменить?"
        placeholderTextColor={lightColors.textMuted}
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
  input: {
    backgroundColor: lightColors.surfaceMuted,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: space[3],
    minHeight: 96,
    color: lightColors.text,
  },
  row: { gap: space[2] },
  error: { ...typography.caption, color: lightColors.danger },
});
