import { formatByn, type FitMode, type PhotoDTO, type ProjectDTO, type Size } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useCatalog, useVariantPrice } from '../../src/catalog/useCatalog';
import { useEditResult } from '../../src/photoEditor/editResultStore';
import { pickPhotos } from '../../src/photos/pickPhotos';
import { frameSizeOf, orientFrame } from '../../src/print/frame';
import { useProjectStore } from '../../src/project/projectStore';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { FramePreview } from '../../src/ui/FramePreview';
import { lightColors, space, typography } from '../../src/theme/theme';

type Frame = { photo: PhotoDTO; copies: number; fit: FitMode };

const DEFAULT_FRAME: Size = { width: 10, height: 15 };

export default function PrintFramesScreen() {
  const { variantId, photoId } = useLocalSearchParams<{ variantId: string; photoId?: string }>();
  const client = useApiClient();
  const catalog = useCatalog();
  const setDraft = useProjectStore((s) => s.setDraft);
  const { width: screenWidth } = useWindowDimensions();
  const project = useRef<ProjectDTO | null>(null);
  const started = useRef(false);
  const pendingEdit = useRef<{ requestId: string; photoId: string } | null>(null);
  const editResults = useEditResult((s) => s.results);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variant = catalog.data?.products.flatMap((p) => p.variants).find((v) => v.id === variantId);
  const paper = (variant && frameSizeOf(variant.format)) || DEFAULT_FRAME;
  const previewWidth = Math.min(140, Math.max(96, screenWidth * 0.3));
  const total = frames.reduce((sum, f) => sum + f.copies, 0);
  const quote = useVariantPrice(total > 0 ? (variantId ?? null) : null, Math.max(1, total));

  async function ensureProject(): Promise<ProjectDTO> {
    if (!project.current) {
      project.current = await client.post<ProjectDTO>('/projects', { variantId, title: 'Печать фото', isShared: false });
    }
    return project.current;
  }

  // Фото из AI-редактора уже есть на сервере: копируем его в проект печати, выбирать заново не нужно.
  useEffect(() => {
    if (!photoId || started.current) return;
    started.current = true;
    setBusy(true);
    void (async () => {
      try {
        const p = await ensureProject();
        const photo = await client.post<PhotoDTO>(`/projects/${p.id}/photos/copy`, { fromPhotoId: photoId });
        setFrames((list) => [...list, { photo, copies: 1, fit: 'contain' }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось добавить фото');
      } finally {
        setBusy(false);
      }
    })();
  }, [photoId]);

  async function addPhotos() {
    setError(null);
    setBusy(true);
    try {
      const picked = await pickPhotos();
      if (picked.length === 0) return;
      const p = await ensureProject();
      for (const item of picked) {
        const photo = await client.upload<PhotoDTO>(`/projects/${p.id}/photos`, { uri: item.uri });
        setFrames((list) => [...list, { photo, copies: 1, fit: 'contain' }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить фото');
    } finally {
      setBusy(false);
    }
  }

  function update(index: number, patch: Partial<Frame>) {
    setFrames((list) => list.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  // Правка кадра в фоторедакторе: готовое фото встаёт на место прежнего, оригинал остаётся в проекте.
  function openEditor(index: number) {
    const current = project.current;
    const frame = frames[index];
    if (!current || !frame) return;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    pendingEdit.current = { requestId, photoId: frame.photo.id };
    router.push({ pathname: '/photo-editor', params: { projectId: current.id, photoId: frame.photo.id, requestId } });
  }

  useEffect(() => {
    const pending = pendingEdit.current;
    if (!pending || !editResults[pending.requestId]) return;
    const photo = useEditResult.getState().take(pending.requestId);
    pendingEdit.current = null;
    if (photo) setFrames((list) => list.map((f) => (f.photo.id === pending.photoId ? { ...f, photo } : f)));
  }, [editResults]);

  async function toCart() {
    const current = project.current;
    if (!current) return;
    setError(null);
    setBusy(true);
    try {
      const layout = {
        pages: frames.map((f) => ({
          template: 'one' as const,
          copies: f.copies,
          cells: [{ photoId: f.photo.id, crop: { x: 0, y: 0, scale: 1, rotation: 0 as const }, fit: f.fit }],
        })),
      };
      const saved = await client.put<{ version: number }>(`/projects/${current.id}`, {
        layout,
        version: current.version,
      });
      setDraft({ ...current, layout, version: saved.version });
      router.push('/(tabs)/cart');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить заказ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ваши отпечатки</Text>
      <Text style={styles.sub}>
        {variant ? `${variant.format}. ` : ''}«С полями» сохраняет всё фото; «Без полей» обрежет края под формат.
      </Text>
      {frames.map((frame, index) => (
        <Card key={frame.photo.id}>
          <View style={styles.row}>
            <FramePreview
              uri={client.resolveUrl(frame.photo.url)}
              photo={frame.photo}
              frame={orientFrame(paper, frame.photo)}
              fit={frame.fit}
              width={previewWidth}
            />
            <View style={styles.controls}>
              <View style={styles.counter}>
                <Button title="−" variant="secondary" onPress={() => update(index, { copies: Math.max(1, frame.copies - 1) })} />
                <Text style={styles.count} accessibilityLabel={`Копий: ${frame.copies}`}>
                  {frame.copies}
                </Text>
                <Button title="+" variant="secondary" onPress={() => update(index, { copies: Math.min(99, frame.copies + 1) })} />
              </View>
              <View style={styles.counter}>
                <Button
                  title="С полями"
                  variant={frame.fit === 'contain' ? 'primary' : 'secondary'}
                  onPress={() => update(index, { fit: 'contain' })}
                />
                <Button
                  title="Без полей"
                  variant={frame.fit === 'cover' ? 'primary' : 'secondary'}
                  onPress={() => update(index, { fit: 'cover' })}
                />
              </View>
              <Button title="Редактор" variant="text" onPress={() => openEditor(index)} />
            </View>
          </View>
        </Card>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={frames.length === 0 ? 'Выбрать фото' : 'Добавить ещё фото'}
        variant={frames.length === 0 ? 'primary' : 'secondary'}
        disabled={busy}
        onPress={() => void addPhotos()}
      />
      {frames.length > 0 ? (
        <>
          <Text style={styles.total}>
            {total} шт.{quote.data ? ` · ${formatByn(quote.data.itemsKop)}` : ''}
          </Text>
          <Button title="В корзину" disabled={busy} onPress={() => void toCart()} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  controls: { flex: 1, gap: space[2] },
  counter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] },
  count: { ...typography.bodyStrong, color: lightColors.text, minWidth: 28, textAlign: 'center' },
  total: { ...typography.bodyStrong, color: lightColors.text },
  error: { ...typography.caption, color: lightColors.danger },
});
