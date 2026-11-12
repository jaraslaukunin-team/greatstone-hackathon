import { themeById, type PhotoDTO } from '@picpac/shared';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { BookViewer } from '../../../src/book/BookViewer';
import { projectSource } from '../../../src/book/imageSource';
import { useProjectStore } from '../../../src/project/projectStore';
import { Button } from '../../../src/ui/Button';
import { darkColors, space, typography } from '../../../src/theme/theme';

/** Итог на весь экран: листание книги без панелей, на последнем развороте — «Заказать». */
export default function PreviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const draft = useProjectStore((s) => s.draft);
  const [photoMap, setPhotoMap] = useState<Map<string, PhotoDTO>>(new Map());
  const [atEnd, setAtEnd] = useState(false);
  const sourceOf = useMemo(() => projectSource(photoMap, client.resolveUrl), [photoMap, client.resolveUrl]);

  useEffect(() => {
    let cancelled = false;
    void client
      .get<PhotoDTO[]>(`/projects/${id}/photos`)
      .then((photos) => {
        if (!cancelled) setPhotoMap(new Map(photos.map((p) => [p.id, p])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, id]);

  // Книга ещё не собрана на этом устройстве — сначала обзор, он её соберёт.
  if (!draft || draft.project.id !== id || !draft.layout.pages.length) {
    return <Redirect href={{ pathname: '/project/[id]/overview', params: { id: String(id) } }} />;
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Закрыть просмотр" onPress={() => router.back()} style={styles.close}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
      <View style={styles.book}>
        <BookViewer
          title={draft.project.title}
          layout={draft.layout}
          sourceOf={sourceOf}
          theme={themeById(draft.layout.themeId)}
          onIndexChange={(index, total) => setAtEnd(index === total - 1)}
        />
      </View>
      <View style={styles.footer}>
        {atEnd ? (
          <Button title="Заказать" onPress={() => router.replace({ pathname: '/project/[id]/review', params: { id: String(id) } })} />
        ) : (
          <Text style={styles.hint}>Листайте до последней страницы</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: darkColors.bg, padding: space[4], justifyContent: 'center' },
  close: { position: 'absolute', top: space[5], right: space[4], width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  closeText: { ...typography.h2, color: darkColors.text },
  book: { width: '100%' },
  footer: { marginTop: space[5], minHeight: 52, justifyContent: 'center' },
  hint: { ...typography.caption, color: darkColors.textSecondary, textAlign: 'center' },
});
