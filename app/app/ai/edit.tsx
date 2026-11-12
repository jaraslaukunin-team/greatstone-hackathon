import type { CatalogDTO, PhotoDTO, ProjectDTO } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { startAiEdit } from '../../src/ai/useAiJob';
import { ApiRequestError, type ApiClient } from '../../src/api/client';
import { pickPhotos } from '../../src/photos/pickPhotos';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

const AI_PROJECT_TITLE = 'AI-редактор';

type ChatMessage = { id: string; role: 'user' | 'system'; text: string };

/** Фото для AI хранятся в служебном проекте: находим его или создаём один раз. */
async function ensureAiProject(client: ApiClient): Promise<ProjectDTO> {
  const projects = await client.get<ProjectDTO[]>('/projects');
  const existing = projects.find((p) => p.title === AI_PROJECT_TITLE && p.status === 'draft');
  if (existing) return existing;
  const catalog = await client.get<CatalogDTO>('/catalog');
  const variantId = catalog.products.find((p) => p.kind === 'photobook')?.variants[0]?.id;
  if (!variantId) throw new Error('Каталог пуст, попробуйте позже');
  return client.post<ProjectDTO>('/projects', { variantId, title: AI_PROJECT_TITLE, isShared: false });
}

export default function AiEditScreen() {
  const params = useLocalSearchParams<{ photoId?: string; projectId?: string; photoUrl?: string }>();
  const client = useApiClient();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [photo, setPhoto] = useState<{ id: string; url: string } | null>(
    params.photoId && params.photoUrl ? { id: params.photoId, url: params.photoUrl } : null,
  );
  const [projectId, setProjectId] = useState<string | null>(params.projectId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<{ jobId: string }> | null>(null);

  async function choosePhoto() {
    setError(null);
    setBusy(true);
    try {
      const picked = await pickPhotos();
      const first = picked[0];
      if (!first) return;
      const project = await ensureAiProject(client);
      const uploaded = await client.upload<PhotoDTO>(`/projects/${project.id}/photos`, { uri: first.uri });
      setProjectId(project.id);
      setPhoto({ id: uploaded.id, url: uploaded.url });
      setMessages([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить фото');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const text = prompt.trim();
    if (!photo || !projectId || text.length === 0 || busy) return;
    setError(null);
    setBusy(true);
    setPrompt('');
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text },
      { id: `s-${Date.now()}`, role: 'system', text: 'Обрабатываем фото…' },
    ]);
    try {
      const { jobId } = await startAiEdit(
        client,
        { projectId, photoId: photo.id, prompt: text, kind: 'edit', aspect: 'original' },
        inFlight,
      );
      router.push({ pathname: '/ai/result', params: { jobId, sourceUrl: photo.url, projectId } });
    } catch (e) {
      setMessages((prev) => [
        ...prev.filter((m) => m.role !== 'system' || m.text !== 'Обрабатываем фото…'),
        {
          id: `e-${Date.now()}`,
          role: 'system',
          text: e instanceof ApiRequestError ? e.message : 'Не удалось запустить обработку',
        },
      ]);
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось запустить AI');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>AI</Text>
        <Text style={styles.sub}>Загрузите фото и напишите в чат, что изменить.</Text>

        {!photo ? (
          <Button title="Загрузить фотографию" disabled={busy} onPress={() => void choosePhoto()} />
        ) : (
          <>
            <Image source={{ uri: client.resolveUrl(photo.url) }} style={styles.preview} resizeMode="contain" />
            <Button title="Выбрать другое фото" variant="secondary" disabled={busy} onPress={() => void choosePhoto()} />
          </>
        )}

        {messages.length > 0 ? (
          <View style={styles.chat}>
            {messages.map((m) => (
              <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleSystem]}>
                <Text style={m.role === 'user' ? styles.bubbleUserText : styles.bubbleSystemText}>{m.text}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      {photo ? (
        <View style={styles.composer}>
          <Input
            multiline
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Напишите промпт…"
            style={styles.input}
          />
          <Button
            title="Отправить"
            disabled={busy || prompt.trim().length === 0}
            onPress={() => void send()}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  scroll: { flex: 1 },
  content: { padding: space[4], gap: space[3], paddingBottom: space[5] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  preview: { width: '100%', height: 240, borderRadius: radius.card, backgroundColor: lightColors.border },
  chat: { gap: space[2], marginTop: space[2] },
  bubble: {
    maxWidth: '92%',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.card,
    minHeight: 44,
    justifyContent: 'center',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: lightColors.accent,
  },
  bubbleSystem: {
    alignSelf: 'flex-start',
    backgroundColor: lightColors.surface,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  bubbleUserText: { ...typography.body, color: lightColors.textOnAccent },
  bubbleSystemText: { ...typography.body, color: lightColors.text },
  composer: {
    padding: space[4],
    gap: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: lightColors.border,
    backgroundColor: lightColors.bg,
  },
  input: { minHeight: 88 },
  error: { ...typography.caption, color: lightColors.danger },
});
