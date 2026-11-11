import type { InteractionDTO } from '@picpac/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { Button } from '../../../src/ui/Button';
import { Input } from '../../../src/ui/Input';
import { lightColors, space, typography } from '../../../src/theme/theme';

export default function SupportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const [text, setText] = useState('');
  const [interaction, setInteraction] = useState<InteractionDTO | null>(null);

  async function send() {
    if (!interaction) {
      const created = await client.post<InteractionDTO>(`/orders/${id}/interactions`, {
        topic: 'Проблема с заказом',
        body: text,
      });
      setInteraction(created);
      setText('');
      return;
    }
    const updated = await client.post<InteractionDTO>(`/interactions/${interaction.id}/messages`, {
      body: text,
    });
    setInteraction(updated);
    setText('');
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Обращение</Text>
      {(interaction?.messages ?? []).map((message) => (
        <Text key={message.id} style={styles.msg}>
          {message.body}
        </Text>
      ))}
      <Input
       
        value={text}
        onChangeText={setText}
        placeholder="Опишите проблему"
      />
      <Button title="Отправить" onPress={() => void send()} disabled={!text.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  msg: { ...typography.body, color: lightColors.text },
});
