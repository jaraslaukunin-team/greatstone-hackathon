import { DEFAULT_THEME_ID, themeById, type CatalogDTO, type PhotoDTO, type ProjectDTO } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { autoLayoutLocal, unplacedPhotos } from '../../../src/editor/autoLayoutLocal';
import { setTheme } from '../../../src/editor/editorActions';
import { useProjectStore } from '../../../src/project/projectStore';
import { useThemeChoice } from '../../../src/project/themeChoiceStore';
import { ThemePicker } from '../../../src/theme/ThemePicker';
import { syncProject } from '../../../src/project/syncProject';
import { Button } from '../../../src/ui/Button';
import { BookViewer } from '../../../src/book/BookViewer';
import { projectSource } from '../../../src/book/imageSource';
import { lightColors, space, typography } from '../../../src/theme/theme';

export default function OverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const { draft, setDraft, setLayout, setSyncState } = useProjectStore();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Собираем вашу книгу…');
  const [photoMap, setPhotoMap] = useState<Map<string, PhotoDTO>>(new Map());
  const [showThemes, setShowThemes] = useState(false);
  const sourceOf = useMemo(() => projectSource(photoMap, client.resolveUrl), [photoMap, client.resolveUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const project = await client.get<ProjectDTO>(`/projects/${id}`);
      const photos = await client.get<PhotoDTO[]>(`/projects/${id}/photos`);
      if (!cancelled) setPhotoMap(new Map(photos.map((p) => [p.id, p])));
      const catalog = await client.get<CatalogDTO>('/catalog').catch(() => null);
      const variant = catalog?.products.flatMap((p) => p.variants).find((v) => v.id === project.variantId);
      // Правки пользователя не затираем: прежний макет (локальный или с сервера) остаётся, пока в нём разложены все фото.
      const stored = useProjectStore.getState().draft;
      const previous = stored?.project.id === project.id ? stored.layout : project.layout;
      const keep =
        previous.pages.some((pg) => pg.cells.some((c) => c.photoId)) && unplacedPhotos(previous, photos).length === 0;
      const laidOut = keep
        ? previous
        : autoLayoutLocal(photos, { pagesMin: variant?.pagesMin ?? 20, pagesMax: variant?.pagesMax ?? 60 });
      // Тема: уже записанная в макете, иначе выбранная до загрузки фото, иначе по умолчанию. Повторная раскладка тему не теряет.
      const chosen = useThemeChoice.getState().get(project.id) ?? DEFAULT_THEME_ID;
      const layout = { ...laidOut, themeId: previous.themeId ?? laidOut.themeId ?? chosen };
      if (cancelled) return;
      setDraft({ ...project, layout });
      setLayout(layout);
      setMessage(`Готово · ${layout.pages.length} страниц`);
      setBusy(false);
      await syncProject({
        client,
        projectId: project.id,
        layout,
        version: project.version,
        onLocalOnly: () => setSyncState('local-only'),
        onSaved: ({ version }) => {
          // Сервер на сохранение отвечает только новой версией; макет остаётся локальным.
          setDraft({ ...project, layout, version });
          setSyncState('saved');
        },
        onConflict: async (server, localLayout) => {
          setDraft({ ...server, layout: localLayout, version: server.version });
          setSyncState('local-only');
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [client, id, setDraft, setLayout, setSyncState]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Обзор книги</Text>
      <Text style={styles.sub}>{message}</Text>
      {draft?.layout?.pages?.length ? (
        <BookViewer
          title={draft.project.title}
          layout={draft.layout}
          sourceOf={sourceOf}
          theme={themeById(draft.layout.themeId)}
          onOpenPage={(page) => router.push(`/project/${id}/spread/${page}`)}
        />
      ) : null}
      <Text style={styles.hint}>Листайте свайпом или стрелками. Нажмите на «Разворот», чтобы открыть его в редакторе.</Text>
      {draft?.layout?.pages?.length ? (
        <>
          <Button title={showThemes ? 'Скрыть оформление' : 'Оформление'} variant="secondary" onPress={() => setShowThemes((v) => !v)} />
          {showThemes ? (
            <ThemePicker
              value={themeById(draft.layout.themeId).id}
              onChange={(themeId) => setLayout(setTheme(draft.layout, themeId))}
            />
          ) : null}
        </>
      ) : null}
      <Button title="Проверить перед заказом" disabled={busy} onPress={() => router.push(`/project/${id}/review`)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginVertical: space[2] },
});
