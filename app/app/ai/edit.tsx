import type { AiJobDTO, CatalogDTO, PhotoDTO, ProjectDTO } from '@picpac/shared';
import { router } from 'expo-router';
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
  const client = useApiClient();
  const [prompt, setPrompt] = useState('Тёплая ретро-плёнка');
  const [photo, setPhoto] = useState<PhotoDTO | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<Promise<AiJobDTO> | null>(null);

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
      setPhoto(uploaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить фото');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!photo || !projectId) return;
    setError(null);
    setBusy(true);
    try {
      const job = await startAiEdit(client, { projectId, photoId: photo.id, prompt }, inFlight);
      router.push({ pathname: '/ai/result', params: { jobId: job.id, original: client.resolveUrl(photo.url) } });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось запустить AI');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>AI-редактор</Text>
      {photo ? <Image source={{ uri: client.resolveUrl(photo.url) }} style={styles.preview} resizeMode="cover" /> : null}
      <Button
        title={photo ? 'Выбрать другое фото' : 'Выбрать фото'}
        variant={photo ? 'secondary' : 'primary'}
        disabled={busy}
        onPress={() => void choosePhoto()}
      />
      <Input multiline value={prompt} onChangeText={setPrompt} placeholder="Что изменить?" />
      <View style={styles.row}>
        {['Ретро', 'На море', 'Студийный свет'].map((preset) => (
          <Button key={preset} title={preset} variant="secondary" onPress={() => setPrompt(preset)} />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Обработать" disabled={!photo || busy || prompt.trim().length === 0} onPress={() => void submit()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  preview: { width: '100%', height: 240, borderRadius: radius.card, backgroundColor: lightColors.border },
  row: { gap: space[2] },
  error: { ...typography.caption, color: lightColors.danger },
});
