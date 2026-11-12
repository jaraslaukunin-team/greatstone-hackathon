import type { InteractionDTO } from '@picpac/shared';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { Button } from '../../../src/ui/Button';
import { Input } from '../../../src/ui/Input';
import { lightColors, space, typography } from '../../../src/theme/theme';

export default function SupportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const [text, setText] = useState('');
  const [interaction, setInteraction] = useState<InteractionDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureInteraction(body: string): Promise<InteractionDTO> {
    if (interaction) return interaction;
    const created = await client.post<InteractionDTO>(`/orders/${id}/interactions`, {
      topic: 'Проблема с заказом',
      body,
    });
    setInteraction(created);
    return created;
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      if (!interaction) {
        await ensureInteraction(body);
      } else {
        const updated = await client.post<InteractionDTO>(`/interactions/${interaction.id}/messages`, {
          body,
        });
        setInteraction(updated);
      }
      setText('');
    } catch {
      setError('Не удалось отправить сообщение');
    } finally {
      setBusy(false);
    }
  }

  async function attachPhoto() {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Нужен доступ к галерее');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: false,
      mediaTypes: ['images'],
      quality: 0.9,
    });
    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    setBusy(true);
    try {
      const chat = await ensureInteraction(text.trim() || 'Прикреплено фото');
      if (!interaction && text.trim()) setText('');
      const updated = await client.upload<InteractionDTO>(`/interactions/${chat.id}/messages/photo`, {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      setInteraction(updated);
    } catch {
      setError('Не удалось отправить фото');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Обращение</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {(interaction?.messages ?? []).map((message) => (
        <View key={message.id} style={styles.msgBlock}>
          {message.body ? <Text style={styles.msg}>{message.body}</Text> : null}
          {message.attachmentUrl ? (
            <Image
              source={{ uri: client.resolveUrl(message.attachmentUrl) }}
              style={styles.thumb}
              accessibilityLabel="Вложение"
            />
          ) : null}
        </View>
      ))}
      <Input value={text} onChangeText={setText} placeholder="Опишите проблему" multiline />
      <Button title="Прикрепить фото" variant="secondary" disabled={busy} onPress={() => void attachPhoto()} />
      <Button title="Отправить" onPress={() => void send()} disabled={busy || !text.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  error: { ...typography.caption, color: lightColors.danger },
  msgBlock: { gap: space[2] },
  msg: { ...typography.body, color: lightColors.text },
  thumb: { width: 120, height: 120, borderRadius: 8, backgroundColor: lightColors.canvas },
});
