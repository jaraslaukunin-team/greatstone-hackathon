import { DEFAULT_THEME_ID, formatByn, themeById, type CatalogDTO, type PhotoDTO, type ProjectDTO, type Rect } from '@picpac/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { hasContent, markSeen, reconcileLayout } from '../../../src/editor/reconcileLayout';
import { moveSpreadBy, replacePhoto, setTheme, type CellRef } from '../../../src/editor/editorActions';
import { useVariantPrice } from '../../../src/catalog/useCatalog';
import { spreadIssues } from '../../../src/book/spreadIssues';
import { SpreadStrip } from '../../../src/book/SpreadStrip';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useEditResult } from '../../../src/photoEditor/editResultStore';
import { useProjectStore } from '../../../src/project/projectStore';
import { useDebouncedSync } from '../../../src/project/useDebouncedSync';
import { blankLayout } from '../../../src/project/blankLayout';
import { useThemeChoice, useThemeChoiceStore } from '../../../src/project/themeChoiceStore';
import { ThemePicker } from '../../../src/theme/ThemePicker';
import { syncProject } from '../../../src/project/syncProject';
import { Button } from '../../../src/ui/Button';
import { BookViewer } from '../../../src/book/BookViewer';
import { projectSource } from '../../../src/book/imageSource';
import { CoverEditor } from '../../../src/book/CoverEditor';
import { PageEditor } from '../../../src/book/PageEditor';
import { lightColors, space, typography } from '../../../src/theme/theme';

export default function OverviewScreen() {
  const { id, page: pageParam } = useLocalSearchParams<{ id: string; page?: string }>();
  const client = useApiClient();
  const { draft, setDraft, setLayout, setSyncState, syncState } = useProjectStore();
  const { width: winW, height: winH } = useWindowDimensions();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Собираем вашу книгу…');
  const [photoMap, setPhotoMap] = useState<Map<string, PhotoDTO>>(new Map());
  const [notice, setNotice] = useState<string | null>(null);
  const [showThemes, setShowThemes] = useState(false);
  const [editingCover, setEditingCover] = useState(false);
  const [editing, setEditing] = useState<{ pageIndex: number; rect: Rect } | null>(null);
  const [limits, setLimits] = useState({ min: 20, max: 60, widthCm: 20 });
  const [viewIndex, setViewIndex] = useState(0);
  const [jump, setJump] = useState<{ index: number; key: number } | undefined>(undefined);
  const [paramHandled, setParamHandled] = useState(false);
  const { user } = useAuth();
  // Фоторедактор открывается отдельным экраном: помним, какую ячейку правили, и вернём правку страницы по возвращении.
  const pendingEdit = useRef<{ requestId: string; ref: CellRef } | null>(null);
  const resume = useRef<{ pageIndex: number; rect: Rect } | null>(null);
  const editResults = useEditResult((s) => s.results);
  const sourceOf = useMemo(() => projectSource(photoMap, client.resolveUrl), [photoMap, client.resolveUrl]);
  const photoList = useMemo(() => Array.from(photoMap.values()), [photoMap]);
  const issues = useMemo(
    () => (draft?.layout ? spreadIssues(draft.layout, Object.fromEntries(photoMap), { pageWidthCm: limits.widthCm }) : []),
    [draft?.layout, photoMap, limits.widthCm],
  );
  const pageCount = draft?.layout?.pages.length ?? 0;
  const quote = useVariantPrice(draft?.project.variantId ?? null, Math.max(1, pageCount));
  // Колбэк стабилен: BookViewer зовёт его из эффекта.
  const onIndexChange = useCallback((index: number) => setViewIndex(index), []);
  // Правки уходят на сервер через секунду после последнего изменения, без кнопки «Сохранить».
  useDebouncedSync(client, id, !busy, (code) =>
    setNotice(
      code === 'PROJECT_ORDERED'
        ? 'Проект уже заказан, изменения не сохраняются.'
        : 'Сервер не принял макет. Проверьте книгу и попробуйте ещё раз.',
    ),
  );
  // Заказанную книгу править нельзя: сервер такие правки отклонит.
  const ordered = draft?.project.status === 'ordered';

  // Готовое фото из редактора ставится в ту же ячейку; оригинал остаётся в проекте.
  useEffect(() => {
    const pending = pendingEdit.current;
    const layout = draft?.layout;
    if (!pending || !layout || !editResults[pending.requestId]) return;
    const photo = useEditResult.getState().take(pending.requestId);
    pendingEdit.current = null;
    if (!photo) return;
    setPhotoMap((m) => new Map(m).set(photo.id, photo));
    // Результат редактора — не «новое фото»: помечаем его учтённым, чтобы повторная сборка не добавила дубль.
    setLayout(markSeen(replacePhoto(layout, pending.ref, photo.id), [photo.id]));
  }, [editResults, draft, setLayout]);

  useFocusEffect(
    useCallback(() => {
      const r = resume.current;
      if (r) {
        resume.current = null;
        setEditing(r);
      }
    }, []),
  );

  // Ссылка вида ?page=N открывает правку этой страницы сразу после загрузки книги.
  useEffect(() => {
    if (busy || paramHandled || pageParam === undefined || !draft?.layout.pages.length) return;
    setParamHandled(true);
    const n = Number(pageParam);
    if (Number.isInteger(n) && n >= 0 && n < draft.layout.pages.length) {
      setEditing({ pageIndex: n, rect: { x: winW / 2 - 80, y: winH / 2 - 80, width: 160, height: 160 } });
    }
  }, [busy, paramHandled, pageParam, draft, winW, winH]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const project = await client.get<ProjectDTO>(`/projects/${id}`);
      const photos = await client.get<PhotoDTO[]>(`/projects/${id}/photos`);
      if (!cancelled) setPhotoMap(new Map(photos.map((p) => [p.id, p])));
      const catalog = await client.get<CatalogDTO>('/catalog').catch(() => null);
      const variant = catalog?.products.flatMap((p) => p.variants).find((v) => v.id === project.variantId);
      if (!cancelled && variant) setLimits({ min: variant.pagesMin, max: variant.pagesMax, widthCm: variant.pageWidthCm });
      // Правки пользователя не затираем: прежний макет (локальный или с сервера) остаётся, пока в нём разложены все фото.
      const stored = useProjectStore.getState().draft;
      const previous = stored?.project.id === project.id ? stored.layout : project.layout;
      // Тема: уже записанная в макете, иначе выбранная до загрузки фото, иначе по умолчанию. Повторная раскладка тему не теряет.
      const chosen = useThemeChoice.getState().get(project.id) ?? DEFAULT_THEME_ID;
      // В ручном режиме и при пустом макете создаём пустую книгу без автораскладки.
      const buildMode = useThemeChoiceStore.getState().mode;
      const isEmpty = !hasContent(previous);
      const pageLimits = { pagesMin: variant?.pagesMin ?? 20, pagesMax: variant?.pagesMax ?? 60 };
      // Правки не затираются: прежний макет сохраняется, добавляются только новые фото.
      const laidOut =
        buildMode === 'manual' && isEmpty
          ? markSeen(blankLayout(pageLimits.pagesMin, chosen), photos.map((p) => p.id))
          : reconcileLayout(previous, photos, pageLimits);
      const layout = { ...laidOut, themeId: previous.themeId ?? laidOut.themeId ?? chosen };
      if (cancelled) return;
      setDraft({ ...project, layout });
      setLayout(layout);
      setMessage(`Готово · ${layout.pages.length} страниц`);
      setBusy(false);
      // Версию обновляем точечно: за время запроса человек мог уже править макет, его правки нельзя затирать.
      const patchVersion = (version: number) =>
        useProjectStore.setState((s) =>
          s.draft?.project.id === project.id ? { draft: { ...s.draft, project: { ...s.draft.project, version } } } : s,
        );
      await syncProject({
        client,
        projectId: project.id,
        layout,
        version: project.version,
        onLocalOnly: () => setSyncState('local-only'),
        onSaved: ({ version }) => {
          patchVersion(version);
          setSyncState('saved');
        },
        onConflict: async (server) => {
          patchVersion(server.version);
          setSyncState('local-only');
        },
        onRejected: (code) => {
          setSyncState('local-only');
          setNotice(
            code === 'PROJECT_ORDERED'
              ? 'Проект уже заказан, изменения не сохраняются.'
              : 'Сервер не принял макет. Проверьте книгу и попробуйте ещё раз.',
          );
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [client, id, setDraft, setLayout, setSyncState]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Книга</Text>
      <Text style={styles.sub}>
        {message}
        {busy ? '' : ` · ${syncState === 'saving' ? 'Сохраняем…' : syncState === 'saved' ? 'Сохранено' : 'Только на устройстве'}`}
      </Text>
      {ordered ? <Text style={styles.sub}>Проект уже заказан, редактирование недоступно.</Text> : null}
      {notice ? <Text style={styles.sub}>{notice}</Text> : null}
      {draft?.layout?.pages?.length ? (
        <BookViewer
          title={draft.project.title}
          layout={draft.layout}
          sourceOf={sourceOf}
          theme={themeById(draft.layout.themeId)}
          onOpenPage={ordered ? undefined : (pageIndex, rect) => setEditing({ pageIndex, rect })}
          onIndexChange={onIndexChange}
          jumpTo={jump}
        />
      ) : null}
      {draft?.layout?.pages?.length ? (
        <SpreadStrip
          layout={draft.layout}
          sourceOf={sourceOf}
          theme={themeById(draft.layout.themeId)}
          issues={issues}
          currentIndex={viewIndex}
          onSelect={(index) => setJump({ index, key: Date.now() })}
          onMove={(index, dir) => {
            if (ordered) return;
            setLayout(moveSpreadBy(draft.layout, index, dir));
            // Книга показывает тот же разворот на новом месте.
            setJump({ index: index + dir, key: Date.now() });
          }}
        />
      ) : null}
      <Text style={styles.hint}>Листайте свайпом или стрелками. Нажмите на страницу, чтобы править её.</Text>
      {draft?.layout?.pages?.length && !ordered ? (
        <>
          <Button title="Обложка" variant="secondary" onPress={() => setEditingCover(true)} />
          <Button title={showThemes ? 'Скрыть оформление' : 'Оформление'} variant="secondary" onPress={() => setShowThemes((v) => !v)} />
          {showThemes ? (
            <ThemePicker
              value={themeById(draft.layout.themeId).id}
              onChange={(themeId) => setLayout(setTheme(draft.layout, themeId))}
            />
          ) : null}
        </>
      ) : null}
      {pageCount > 0 ? (
        <Text style={styles.price}>
          {pageCount} стр.{quote.data ? ` · ${formatByn(quote.data.totalKop)}` : ''}
          {quote.stale ? ' · цена обновляется' : ''}
        </Text>
      ) : null}
      <Button
        title="Смотреть результат"
        variant="secondary"
        disabled={busy || !draft?.layout?.pages?.length}
        onPress={() => router.push({ pathname: '/project/[id]/preview', params: { id: String(id) } })}
      />
      <Button title="Проверить перед заказом" disabled={busy} onPress={() => router.push(`/project/${id}/review`)} />
      {editingCover && draft?.layout ? (
        <CoverEditor
          layout={draft.layout}
          projectTitle={draft.project.title}
          photos={photoList}
          sourceOf={sourceOf}
          theme={themeById(draft.layout.themeId)}
          onChange={setLayout}
          onClose={() => setEditingCover(false)}
        />
      ) : null}
      {editing && draft?.layout ? (
        <PageEditor
          pageIndex={editing.pageIndex}
          layout={draft.layout}
          photos={photoList}
          sourceOf={sourceOf}
          theme={themeById(draft.layout.themeId)}
          originRect={editing.rect}
          pagesMin={limits.min}
          pagesMax={limits.max}
          pageWidthCm={limits.widthCm}
          onChange={setLayout}
          canEditPhoto={(p) => draft.project.ownerId === user?.id || p.uploadedBy === user?.id}
          onOpenPhotoEditor={(photoId, ref) => {
            const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            pendingEdit.current = { requestId, ref };
            resume.current = editing;
            // Окно правки закрывается: оно лежит поверх всех экранов и закрыло бы редактор.
            setEditing(null);
            router.push({ pathname: '/photo-editor', params: { projectId: String(id), photoId, requestId } });
          }}
          onGoto={(pageIndex) => setEditing((e) => (e ? { ...e, pageIndex } : e))}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  price: { ...typography.price, color: lightColors.text },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginVertical: space[2] },
});
