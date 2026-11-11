import type { InteractionDTO } from '@picpac/shared';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { EmptyState } from '../../src/ui/EmptyState';
import { Input } from '../../src/ui/Input';
import { lightColors, space, typography } from '../../src/theme/theme';

const STATUS: Record<InteractionDTO['status'], string> = {
  open: 'Ждёт ответа',
  answered: 'Отвечено',
  closed: 'Закрыто',
};

export default function StaffInboxScreen() {
  const client = useApiClient();
  const [items, setItems] = useState<InteractionDTO[] | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    void client
      .get<InteractionDTO[]>('/interactions')
      .then(setItems)
      .catch(() => setError('Не удалось загрузить обращения'));
  }
  useEffect(load, [client]);

  async function reply(id: string) {
    const body = (replies[id] ?? '').trim();
    if (!body) return;
    try {
      const updated = await client.post<InteractionDTO>(`/interactions/${id}/messages`, { body });
      setItems((list) => (list ?? []).map((i) => (i.id === id ? updated : i)));
      setReplies((r) => ({ ...r, [id]: '' }));
    } catch {
      setError('Не удалось отправить ответ');
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items && items.length === 0 ? (
        <EmptyState icon="info" title="Обращений нет" message="Когда клиент напишет в поддержку, оно появится здесь" />
      ) : null}
      {(items ?? []).map((item) => (
        <Card key={item.id}>
          <Text style={styles.title}>{item.topic}</Text>
          <Text style={styles.status}>{STATUS[item.status]}</Text>
          {item.messages.map((m) => (
            <View key={m.id} style={styles.msg}>
              <Text style={styles.msgText}>{m.body}</Text>
            </View>
          ))}
          <Input
            value={replies[item.id] ?? ''}
            onChangeText={(t) => setReplies((r) => ({ ...r, [item.id]: t }))}
            placeholder="Ответ клиенту"
            multiline
          />
          <Button title="Ответить" onPress={() => void reply(item.id)} disabled={!(replies[item.id] ?? '').trim()} />
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.bodyStrong, color: lightColors.text },
  status: { ...typography.caption, color: lightColors.textSecondary, marginBottom: space[2] },
  msg: { paddingVertical: space[1] },
  msgText: { ...typography.body, color: lightColors.text },
  error: { ...typography.caption, color: lightColors.danger },
});
