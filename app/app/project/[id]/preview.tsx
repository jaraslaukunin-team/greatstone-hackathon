import { buildTimelineSpread, themeById, type CatalogDTO, type PhotoDTO } from '@picpac/shared';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storyTimeline } from '../../../src/album/storyTimeline';
import { tr } from '../../../src/i18n/runtimeTranslate';
import { useSettingsStore } from '../../../src/settings/settingsStore';
import { trailerChapters } from '../../../src/album/trailerChapters';
import { useApiClient } from '../../../src/api/hooks';
import { BookViewer } from '../../../src/book/BookViewer';
import { projectSource } from '../../../src/book/imageSource';
import { useProjectStore } from '../../../src/project/projectStore';
import { DownloadBookPdf } from '../../../src/project/DownloadBookPdf';
import { Button } from '../../../src/ui/Button';
import { darkColors, space, typography } from '../../../src/theme/theme';

/** Итог на весь экран: листание книги без панелей, на последнем развороте — «Заказать». */
export default function PreviewScreen() {
  const { id, mode, omitted } = useLocalSearchParams<{ id: string; mode?: string; omitted?: string }>();
  const isTrailer = mode === 'time-machine';
  const omittedPhotos = Number(omitted ?? 0);
  const lang = useSettingsStore((state) => state.lang);
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const client = useApiClient();
  const draft = useProjectStore((s) => s.draft);
  const setDraft = useProjectStore((s) => s.setDraft);
  const [savingSpread, setSavingSpread] = useState(false);
  const [spreadError, setSpreadError] = useState<string | null>(null);
  const [photoMap, setPhotoMap] = useState<Map<string, PhotoDTO>>(new Map());
  const [position, setPosition] = useState({ index: 0, total: 0 });
  const [jump, setJump] = useState<{ index: number; key: number }>();
  const handleIndex = useCallback((index: number, total: number) => setPosition({ index, total }), []);
  const chapters = useMemo(() => isTrailer && draft ? trailerChapters(draft.layout) : [], [isTrailer, draft]);
  const moments = useMemo(() => isTrailer && draft ? storyTimeline(draft.layout, photoMap) : [], [isTrailer, draft, photoMap]);
  const years = [...new Set(moments.map(({ day }) => day?.slice(0, 4) ?? 'undated'))];
  const visibleMoments = yearFilter ? moments.filter(({ day }) => (day?.slice(0, 4) ?? 'undated') === yearFilter) : moments;
  function jumpTo(index: number) {
    setJump((previous) => ({ index, key: (previous?.key ?? 0) + 1 }));
  }
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

  const current = draft;
  async function addTimelineSpread() {
    if (savingSpread) return;
    setSavingSpread(true);
    setSpreadError(null);
    try {
      const project = await client.get<typeof current.project>(`/projects/${id}`);
      const catalog = await client.get<CatalogDTO>('/catalog');
      const variant = catalog.products.flatMap((product) => product.variants).find((item) => item.id === project.variantId);
      const layout = current.layout;
      const existing = layout.pages.findIndex((page) => page.timeline === 'left');
      const pages = [...layout.pages];
      const timeline = buildTimelineSpread([...photoMap.values()], lang);
      if (existing >= 0 && pages[existing + 1]?.timeline === 'right') {
        pages.splice(existing, 2, ...timeline);
      } else {
        if (pages.length % 2 === 0) pages.push({ template: 'one', cells: [] });
        pages.push(...timeline);
      }
      if (!variant || pages.length > variant.pagesMax) {
        setSpreadError(tr('В книге нет места для нового разворота.'));
        return;
      }
      const next = { ...layout, pages };
      const { version } = await client.put<{ version: number }>(`/projects/${id}`, { layout: next, version: project.version });
      setDraft({ ...project, layout: next, version });
      jumpTo(Math.ceil(pages.findIndex((page) => page.timeline === 'left') / 2));
    } catch (error) {
      setSpreadError(error instanceof Error ? error.message : tr('Не удалось добавить разворот.'));
    } finally {
      setSavingSpread(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + space[4] }]}>
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
          <Text style={styles.hint}>{tr('Разворот')} {position.index + 1} / {Math.max(1, position.total)}</Text>
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
                  onPress={() => jumpTo(spread)}
                />
              ))}
            </ScrollView>
          ) : null}
          {moments.length > 0 ? (
            <>
              <Text style={styles.trailerTitle}>{tr('Лента воспоминаний')}</Text>
              <ScrollView horizontal contentContainerStyle={styles.chapterList}>
                <Button title={tr('Все даты')} variant={yearFilter === null ? 'primary' : 'secondary'} onPress={() => setYearFilter(null)} />
                {years.map((year) => (
                  <Button key={year} title={year === 'undated' ? tr('Без даты') : year}
                    variant={yearFilter === year ? 'primary' : 'secondary'} onPress={() => setYearFilter(year)} />
                ))}
              </ScrollView>
              <ScrollView horizontal contentContainerStyle={styles.chapterList}>
                {visibleMoments.map(({ photo, day, spread }) => {
                  const date = day ? new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(day)) : tr('Без даты');
                  return (
                    <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={date}
                      accessibilityState={{ selected: position.index === spread }}
                      onPress={() => jumpTo(spread)} style={[styles.moment, position.index === spread && styles.activeMoment]}>
                      <Image source={{ uri: client.resolveUrl(photo.url) }} style={styles.momentPhoto} />
                      <Text style={styles.hint}>{date}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {years.length === 1 && years[0] === 'undated' ? (
                <Text style={styles.hint}>{tr('У этих фото нет даты съёмки. Загрузите оригинальные JPEG с EXIF.')}</Text>
              ) : null}
            </>
          ) : null}
          {omittedPhotos > 0 ? (
            <Text style={styles.hint}>{tr('Фото за лимитом страниц остались в лотке:')} {omittedPhotos}</Text>
          ) : null}
          {draft.project.status === 'draft' ? (
            <>
              {[...photoMap.values()].some((photo) => photo.takenAt) ? (
                <Button title={tr('Добавить разворот с датами')} variant="secondary" disabled={savingSpread}
                  onPress={() => void addTimelineSpread()} />
              ) : null}
              {spreadError ? <Text style={styles.hint}>{spreadError}</Text> : null}
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
      <DownloadBookPdf projectId={id} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: darkColors.bg },
  content: { flexGrow: 1, paddingHorizontal: space[4], justifyContent: 'center' },
  moment: { width: 112, borderWidth: 2, borderColor: darkColors.border, borderRadius: 10, padding: 4, gap: 4 },
  activeMoment: { borderColor: '#79B7E8' },
  momentPhoto: { width: '100%', height: 72, borderRadius: 6 },
  close: { position: 'absolute', right: space[4], width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  closeText: { ...typography.h2, color: darkColors.text },
  trailerTitle: { ...typography.h2, color: darkColors.text, textAlign: 'center', marginBottom: space[4] },
  book: { width: '100%' },
  chapterList: { gap: space[2] },
  footer: { marginTop: space[5], minHeight: 52, gap: space[2], justifyContent: 'center' },
  hint: { ...typography.caption, color: darkColors.textSecondary, textAlign: 'center' },
});
