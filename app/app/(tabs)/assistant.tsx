import type { PhotoDTO, ProjectDTO } from '@picpac/shared';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { ApiRequestError } from '../../src/api/client';
import { startAiEdit } from '../../src/ai/useAiJob';
import { useAssistantChat } from '../../src/ai/useAssistantChat';
import { useProjectStore } from '../../src/project/projectStore';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

type Segment = 'editor' | 'chat';

const PRESETS: { title: string; prompt: string; kind: 'edit' | 'upscale' }[] = [
  { title: 'В лимузине', prompt: 'я в лимузине', kind: 'edit' },
  { title: 'На море', prompt: 'я на море на закате', kind: 'edit' },
  { title: 'Ретро', prompt: 'тёплая ретро-плёнка', kind: 'edit' },
  { title: 'Апскейл', prompt: 'увеличь качество и детализацию', kind: 'upscale' },
];

function Stepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepLabel}>
        {label}: {value.toFixed(2)}
      </Text>
      <View style={styles.stepRow}>
        <Pressable
          style={styles.stepBtn}
          onPress={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <Pressable
          style={styles.stepBtn}
          onPress={() => onChange(Math.min(max, Number((value + step).toFixed(2))))}
        >
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AssistantScreen() {
  const client = useApiClient();
  const draft = useProjectStore((s) => s.draft);
  const [segment, setSegment] = useState<Segment>('editor');
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('я в лимузине');
  const [kind, setKind] = useState<'edit' | 'upscale'>('edit');
  const [brightness, setBrightness] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);
  const [sharpen, setSharpen] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [orders, setOrders] = useState<{ id: string; number: string }[]>([]);
  const inFlight = useRef<Promise<{ jobId: string }> | null>(null);
  const chat = useAssistantChat(client);
  const projectId = draft?.project.id;

  useEffect(() => {
    if (!projectId) return;
    void client
      .get<PhotoDTO[]>(`/projects/${projectId}/photos`)
      .then((list) => {
        setPhotos(list);
        setPhotoId(list[0]?.id ?? null);
      })
      .catch(() => setPhotos([]));
  }, [client, projectId]);

  useEffect(() => {
    void client
      .get<{ id: string; number: string }[]>('/orders')
      .then((list) => setOrders(list.map((o) => ({ id: o.id, number: o.number }))))
      .catch(() => setOrders([]));
  }, [client]);

  async function ensureConsent() {
    await client.post('/ai/consent', { consent: true });
  }

  async function onAdjust() {
    if (!projectId || !photoId) {
      setError('Выберите проект и фото во вкладке «Мои»');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const photo = await client.post<PhotoDTO>('/ai/adjust', {
        projectId,
        photoId,
        brightness,
        contrast,
        saturation,
        sharpen: sharpen > 0 ? sharpen : undefined,
      });
      setPhotos((prev) => [...prev, photo]);
      setPhotoId(photo.id);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось применить правки');
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate() {
    if (!projectId || !photoId) {
      setError('Выберите проект и фото во вкладке «Мои»');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureConsent();
      const { jobId } = await startAiEdit(
        client,
        { projectId, photoId, prompt, kind },
        inFlight,
      );
      router.push({ pathname: '/ai/result', params: { jobId, sourceUrl: photos.find((p) => p.id === photoId)?.url ?? '' } });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось запустить AI');
    } finally {
      setBusy(false);
    }
  }

  async function createProjectIfNeeded() {
    setBusy(true);
    setError(null);
    try {
      const catalog = await client.get<{ products: { variants: { id: string }[] }[] }>('/catalog');
      const variantId = catalog.products[0]?.variants[0]?.id;
      if (!variantId) throw new Error('Нет вариантов в каталоге');
      const project = await client.post<ProjectDTO>('/projects', {
        variantId,
        title: 'AI черновик',
      });
      useProjectStore.getState().setDraft(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать проект');
    } finally {
      setBusy(false);
    }
  }

  const selected = photos.find((p) => p.id === photoId);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Ассистент</Text>
      <View style={styles.segments}>
        <Pressable
          style={[styles.segment, segment === 'editor' && styles.segmentOn]}
          onPress={() => setSegment('editor')}
        >
          <Text style={[styles.segmentText, segment === 'editor' && styles.segmentTextOn]}>Редактор</Text>
        </Pressable>
        <Pressable
          style={[styles.segment, segment === 'chat' && styles.segmentOn]}
          onPress={() => setSegment('chat')}
        >
          <Text style={[styles.segmentText, segment === 'chat' && styles.segmentTextOn]}>Чат</Text>
        </Pressable>
      </View>

      {segment === 'editor' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {!projectId ? (
            <>
              <Text style={styles.sub}>Нужен черновик проекта с фото.</Text>
              <Button title="Создать черновик" onPress={() => void createProjectIfNeeded()} />
              <Button title="К моим дизайнам" variant="secondary" onPress={() => router.push('/(tabs)/designs')} />
            </>
          ) : (
            <>
              {selected?.url ? (
                <Image source={{ uri: selected.url }} style={styles.preview} resizeMode="cover" />
              ) : (
                <Text style={styles.sub}>Загрузите фото в проект, затем вернитесь сюда.</Text>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
                {photos.map((p) => (
                  <Pressable key={p.id} onPress={() => setPhotoId(p.id)}>
                    <Image
                      source={{ uri: p.url }}
                      style={[styles.thumb, photoId === p.id && styles.thumbOn]}
                    />
                  </Pressable>
                ))}
              </ScrollView>
              <Button
                title="Загрузить фото"
                variant="secondary"
                onPress={() => router.push(`/project/${projectId}/photos`)}
              />

              <Text style={styles.h2}>Без ИИ</Text>
              <Stepper label="Яркость" value={brightness} min={0.5} max={1.5} step={0.05} onChange={setBrightness} />
              <Stepper label="Контраст" value={contrast} min={0.5} max={1.5} step={0.05} onChange={setContrast} />
              <Stepper label="Насыщенность" value={saturation} min={0} max={2} step={0.1} onChange={setSaturation} />
              <Stepper label="Резкость" value={sharpen} min={0} max={5} step={0.5} onChange={setSharpen} />
              <Button title="Применить правки" onPress={() => void onAdjust()} disabled={busy} />

              <Text style={styles.h2}>Генеративный ИИ</Text>
              <View style={styles.presets}>
                {PRESETS.map((p) => (
                  <Button
                    key={p.title}
                    title={p.title}
                    variant="secondary"
                    onPress={() => {
                      setPrompt(p.prompt);
                      setKind(p.kind);
                    }}
                  />
                ))}
              </View>
              <Input multiline value={prompt} onChangeText={setPrompt} placeholder="Например: я в лимузине" />
              <Button title="Обработать с ИИ" onPress={() => void onGenerate()} disabled={busy} />
            </>
          )}
          {busy ? <ActivityIndicator color={lightColors.accent} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      ) : (
        <View style={styles.chatWrap}>
          <ScrollView contentContainerStyle={styles.chatList}>
            {chat.messages.map((m, i) => (
              <View
                key={`${m.role}-${i}`}
                style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}
              >
                <Text style={styles.bubbleText}>{m.content}</Text>
              </View>
            ))}
          </ScrollView>
          <ScrollView horizontal contentContainerStyle={styles.chips}>
            <Pressable
              style={[styles.chip, !chat.orderId && styles.chipOn]}
              onPress={() => chat.setOrderId(undefined)}
            >
              <Text style={styles.chipText}>Без заказа</Text>
            </Pressable>
            {orders.map((o) => (
              <Pressable
                key={o.id}
                style={[styles.chip, chat.orderId === o.id && styles.chipOn]}
                onPress={() => chat.setOrderId(o.id)}
              >
                <Text style={styles.chipText}>{o.number}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {chat.error ? <Text style={styles.error}>{chat.error}</Text> : null}
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Спросите про заказ или каталог"
              placeholderTextColor={lightColors.textMuted}
            />
            <Button
              title="↵"
              onPress={() => {
                const t = chatInput;
                setChatInput('');
                void chat.send(t);
              }}
              disabled={chat.sending}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, paddingTop: space[7] },
  title: { ...typography.h1, color: lightColors.text, paddingHorizontal: space[4] },
  segments: {
    flexDirection: 'row',
    margin: space[4],
    backgroundColor: lightColors.surfaceMuted,
    borderRadius: radius.button,
    padding: 4,
  },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.button },
  segmentOn: { backgroundColor: lightColors.surface },
  segmentText: { ...typography.bodyStrong, color: lightColors.textMuted },
  segmentTextOn: { color: lightColors.text },
  content: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  sub: { ...typography.body, color: lightColors.textMuted },
  h2: { ...typography.h2, color: lightColors.text, marginTop: space[3] },
  preview: { width: '100%', height: 220, borderRadius: radius.card, backgroundColor: lightColors.canvas },
  thumbs: { gap: space[2] },
  thumb: { width: 64, height: 64, borderRadius: 8, marginRight: space[2] },
  thumbOn: { borderWidth: 2, borderColor: lightColors.accent },
  stepper: { gap: space[2] },
  stepLabel: { ...typography.body, color: lightColors.text },
  stepRow: { flexDirection: 'row', gap: space[2] },
  stepBtn: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: radius.button,
    backgroundColor: lightColors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { ...typography.h2, color: lightColors.text },
  presets: { gap: space[2] },
  error: { ...typography.caption, color: lightColors.danger },
  chatWrap: { flex: 1, paddingHorizontal: space[4], paddingBottom: space[4], gap: space[2] },
  chatList: { gap: space[2], paddingBottom: space[3] },
  bubble: { maxWidth: '88%', padding: space[3], borderRadius: radius.card },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: lightColors.accentSoft },
  bubbleBot: { alignSelf: 'flex-start', backgroundColor: lightColors.surfaceMuted },
  bubbleText: { ...typography.body, color: lightColors.text },
  chips: { gap: space[2], paddingVertical: space[1] },
  chip: {
    paddingHorizontal: space[3],
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: lightColors.surfaceMuted,
    marginRight: space[2],
  },
  chipOn: { backgroundColor: lightColors.accentSoft },
  chipText: { ...typography.caption, color: lightColors.text },
  chatInputRow: { flexDirection: 'row', gap: space[2], alignItems: 'center' },
  chatInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: lightColors.border,
    paddingHorizontal: space[3],
    color: lightColors.text,
    backgroundColor: lightColors.surface,
  },
});
