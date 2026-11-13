import { themeById, type PhotoDTO } from '@picpac/shared';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { trailerChapters } from '../../../src/album/trailerChapters';
import { useApiClient } from '../../../src/api/hooks';
import { BookViewer } from '../../../src/book/BookViewer';
import { projectSource } from '../../../src/book/imageSource';
import { useProjectStore } from '../../../src/project/projectStore';
import { Button } from '../../../src/ui/Button';
import { darkColors, space, typography } from '../../../src/theme/theme';

/** Итог на весь экран: листание книги без панелей, на последнем развороте — «Заказать». */
export default function PreviewScreen() {
  const { id, mode, omitted } = useLocalSearchParams<{ id: string; mode?: string; omitted?: string }>();
  const isTrailer = mode === 'time-machine';
  const omittedPhotos = Number(omitted ?? 0);
  const insets = useSafeAreaInsets();
  const client = useApiClient();
  const draft = useProjectStore((s) => s.draft);
  const [photoMap, setPhotoMap] = useState<Map<string, PhotoDTO>>(new Map());
  const [position, setPosition] = useState({ index: 0, total: 0 });
  const [jump, setJump] = useState<{ index: number; key: number }>();
  const handleIndex = useCallback((index: number, total: number) => setPosition({ index, total }), []);
  const chapters = useMemo(() => isTrailer && draft ? trailerChapters(draft.layout) : [], [isTrailer, draft]);
  const atEnd = position.index === position.total - 1;
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
      <Pressable accessibilityRole="button" accessibilityLabel="Закрыть просмотр" onPress={() => router.back()} style={[styles.close, { top: insets.top }]}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
      {isTrailer ? <Text style={styles.trailerTitle}>PicPac Time Machine</Text> : null}
      <View style={styles.book}>
        <BookViewer
          title={draft.project.title}
          layout={draft.layout}
          sourceOf={sourceOf}
          theme={themeById(draft.layout.themeId)}
          onIndexChange={handleIndex}
          jumpTo={jump}
        />
      </View>
      {isTrailer ? (
        <View style={styles.footer}>
          <Text style={styles.hint}>Разворот {position.index + 1} из {Math.max(1, position.total)}</Text>
          <Text style={styles.hint}>
            {chapters.length > 0 ? 'Листайте или выберите главу' : 'Предпросмотр сохранённой книги. Листайте развороты.'}
          </Text>
          {chapters.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chapterList}>
              {chapters.map(({ page, spread, title }) => (
                <Button
                  key={page}
                  title={title}
                  variant={position.index === spread ? 'primary' : 'secondary'}
                  accessibilityState={{ selected: position.index === spread }}
                  onPress={() => setJump((previous) => ({ index: spread, key: (previous?.key ?? 0) + 1 }))}
                />
              ))}
            </ScrollView>
          ) : null}
          {omittedPhotos > 0 ? (
            <Text style={styles.hint}>Фото за лимитом страниц остались в лотке: {omittedPhotos}</Text>
          ) : null}
          {draft.project.status === 'draft' ? (
            <>
              <Button title="Заказать печать" onPress={() => router.replace({ pathname: '/project/[id]/review', params: { id: String(id) } })} />
              <Button title="Редактировать книгу" variant="secondary" onPress={() => router.push({ pathname: '/project/[id]/overview', params: { id: String(id) } })} />
            </>
          ) : null}
        </View>
      ) : (
        <View style={styles.footer}>
          {atEnd ? (
            <Button title="Заказать" onPress={() => router.replace({ pathname: '/project/[id]/review', params: { id: String(id) } })} />
          ) : (
            <Text style={styles.hint}>Листайте до последней страницы</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: darkColors.bg, padding: space[4], justifyContent: 'center' },
  close: { position: 'absolute', right: space[4], width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  closeText: { ...typography.h2, color: darkColors.text },
  trailerTitle: { ...typography.h2, color: darkColors.text, textAlign: 'center', marginBottom: space[4] },
  book: { width: '100%' },
  chapterList: { gap: space[2] },
  footer: { marginTop: space[5], minHeight: 52, gap: space[2], justifyContent: 'center' },
  hint: { ...typography.caption, color: darkColors.textSecondary, textAlign: 'center' },
});
