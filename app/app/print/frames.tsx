import { formatByn, type PhotoDTO, type ProjectDTO } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useVariantPrice } from '../../src/catalog/useCatalog';
import { pickPhotos } from '../../src/photos/pickPhotos';
import { useProjectStore } from '../../src/project/projectStore';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

type Frame = { photo: PhotoDTO; copies: number };

export default function PrintFramesScreen() {
  const { variantId } = useLocalSearchParams<{ variantId: string }>();
  const client = useApiClient();
  const setDraft = useProjectStore((s) => s.setDraft);
  const project = useRef<ProjectDTO | null>(null);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = frames.reduce((sum, f) => sum + f.copies, 0);
  const quote = useVariantPrice(total > 0 ? (variantId ?? null) : null, Math.max(1, total));

  async function addPhotos() {
    setError(null);
    setBusy(true);
    try {
      const picked = await pickPhotos();
      if (picked.length === 0) return;
      if (!project.current) {
        project.current = await client.post<ProjectDTO>('/projects', {
          variantId,
          title: 'Печать фото',
          isShared: false,
        });
      }
      for (const item of picked) {
        const photo = await client.upload<PhotoDTO>(`/projects/${project.current.id}/photos`, { uri: item.uri });
        setFrames((list) => [...list, { photo, copies: 1 }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить фото');
    } finally {
      setBusy(false);
    }
  }

  function setCopies(index: number, delta: number) {
    setFrames((list) =>
      list.map((f, i) => (i === index ? { ...f, copies: Math.max(1, Math.min(99, f.copies + delta)) } : f)),
    );
  }

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
          cells: [{ photoId: f.photo.id, crop: { x: 0, y: 0, scale: 1, rotation: 0 as const } }],
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
      {frames.length === 0 ? (
        <Text style={styles.sub}>Выберите фото из галереи, затем укажите, сколько копий каждого нужно.</Text>
      ) : null}
      {frames.map((frame, index) => (
        <Card key={frame.photo.id}>
          <View style={styles.row}>
            <Image source={{ uri: client.resolveUrl(frame.photo.url) }} style={styles.thumb} />
            <View style={styles.counter}>
              <Button title="−" variant="secondary" onPress={() => setCopies(index, -1)} />
              <Text style={styles.count}>{frame.copies}</Text>
              <Button title="+" variant="secondary" onPress={() => setCopies(index, 1)} />
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
  thumb: { width: 84, height: 84, borderRadius: radius.photo, backgroundColor: lightColors.border },
  counter: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginLeft: 'auto' },
  count: { ...typography.bodyStrong, color: lightColors.text, minWidth: 28, textAlign: 'center' },
  total: { ...typography.bodyStrong, color: lightColors.text },
  error: { ...typography.caption, color: lightColors.danger },
});
