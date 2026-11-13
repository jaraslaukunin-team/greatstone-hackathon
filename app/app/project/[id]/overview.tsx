import { AddProjectPhotos } from '../../../src/photos/AddProjectPhotos';
import { buildTimeMachineLayout, DEFAULT_THEME_ID, formatByn, themeById, type CatalogDTO, type PhotoDTO, type ProjectDTO, type Rect } from '@picpac/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BookTabs, type BookTab } from '../../../src/book/BookTabs';
import { CoverColors } from '../../../src/book/CoverColors';
import { CoverView } from '../../../src/book/CoverView';
import { coverPage, coverTitle } from '../../../src/book/cover';
import { PagesGrid } from '../../../src/book/PagesGrid';
import { spreadPhotoCount, spreadRange } from '../../../src/book/spreadInfo';
import { useApiClient } from '../../../src/api/hooks';
import { hasContent, markSeen, reconcileLayout } from '../../../src/editor/reconcileLayout';
import { addSpread, replacePhoto, setCover, setTheme, type CellRef } from '../../../src/editor/editorActions';
import { useVariantPrice } from '../../../src/catalog/useCatalog';
import { goodsPriceKop } from '../../../src/checkout/goodsPrice';
import { spreadIssues } from '../../../src/book/spreadIssues';
import { useAuth } from '../../../src/auth/AuthProvider';
import { useEditResult } from '../../../src/photoEditor/editResultStore';
import { useProjectStore } from '../../../src/project/projectStore';
import { useDebouncedSync } from '../../../src/project/useDebouncedSync';
import { blankLayout } from '../../../src/project/blankLayout';
import { useThemeChoice, useThemeChoiceStore } from '../../../src/project/themeChoiceStore';
import { ThemePicker } from '../../../src/theme/ThemePicker';
import { syncProject } from '../../../src/project/syncProject';
import { tr } from '../../../src/i18n/runtimeTranslate';
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
  // Вкладка книги: «Разворот» открыта по умолчанию, как раньше открывалась листалка.
  const [tab, setTab] = useState<BookTab>('spread');
  const [confirmTimeline, setConfirmTimeline] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [editingCover, setEditingCover] = useState(false);
  const [editing, setEditing] = useState<{ pageIndex: number; rect: Rect } | null>(null);
  const [limits, setLimits] = useState({ min: 20, max: 60, widthCm: 20 });
  const [viewIndex, setViewIndex] = useState(0);
  const [jump, setJump] = useState<{ index: number; key: number } | undefined>(undefined);
  const handledParam = useRef<string | undefined>(undefined);
  const goTab = useCallback(
    (next: BookTab) => {
      setTab(next);
      // Листалка не размонтируется, но после скрытия возвращаем её на текущий разворот.
      if (next === 'spread') setJump({ index: viewIndex, key: Date.now() });
    },
    [viewIndex],
  );
  const { user, ready } = useAuth();
  // Фоторедактор открывается отдельным экраном: помним, какую ячейку правили, и вернём правку страницы по возвращении.
  const pendingEdit = useRef<{ requestId: string; ref: CellRef } | null>(null);
  const resume = useRef<{ pageIndex: number; rect: Rect } | null>(null);
  const editResults = useEditResult((s) => s.results);
  const sourceOf = useMemo(() => projectSource(photoMap, client.resolveUrl), [photoMap, client.resolveUrl]);
  function addPhoto(photo: PhotoDTO) {
    setPhotoMap((map) => new Map(map).set(photo.id, photo));
  }
  const photoList = useMemo(() => Array.from(photoMap.values()), [photoMap]);
  const photoUpload = draft?.project.status === 'draft' && id
    ? <AddProjectPhotos projectId={id} existingPhotos={photoList} onAdded={addPhoto} />
    : undefined;
  const layoutForIssues = draft?.layout;
  const issues = useMemo(
    () => layoutForIssues ? spreadIssues(layoutForIssues, Object.fromEntries(photoMap), { pageWidthCm: limits.widthCm }) : [],
    [layoutForIssues, photoMap, limits.widthCm],
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

  // Ссылка вида ?page=N (в том числе пришедшая с экрана расстановки фото) открывает правку этой страницы.
  // Параметр сбрасывается после обработки, чтобы тот же номер можно было открыть ещё раз; заказанный проект не правится.
  useFocusEffect(useCallback(() => {
    if (pageParam === undefined) {
      handledParam.current = undefined;
      return;
    }
    if (busy || handledParam.current === pageParam || !draft?.layout.pages.length) return;
    handledParam.current = pageParam;
    const n = Number(pageParam);
    if (!ordered && Number.isInteger(n) && n >= 0 && n < draft.layout.pages.length) {
      setEditing({ pageIndex: n, rect: { x: winW / 2 - 80, y: winH / 2 - 80, width: 160, height: 160 } });
    }
    router.setParams({ page: undefined });
  }, [busy, pageParam, draft, ordered, winW, winH]));

  useEffect(() => {
    if (!ready || !id) return;
    let cancelled = false;
    void (async () => {
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
      const selectedPages = useThemeChoice.getState().initialPages[project.id];
      const initialLimits =
        isEmpty && selectedPages !== undefined &&
        selectedPages >= pageLimits.pagesMin && selectedPages <= pageLimits.pagesMax
          ? { pagesMin: selectedPages, pagesMax: selectedPages }
          : pageLimits;
      // Правки не затираются: прежний макет сохраняется, добавляются только новые фото.
      const laidOut =
        buildMode === 'manual' && isEmpty
          ? markSeen(blankLayout(initialLimits.pagesMin, chosen), photos.map((p) => p.id))
          : reconcileLayout(previous, photos, initialLimits);
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
    })().catch((error: unknown) => {
      if (cancelled) return;
      setMessage(error instanceof Error ? error.message : 'Не удалось открыть книгу');
      setBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [client, id, ready, setDraft, setLayout, setSyncState]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Книга</Text>
      <Text style={styles.sub}>
        {message}
        {busy ? '' : ` · ${syncState === 'saving' ? 'Сохраняем…' : syncState === 'saved' ? 'Сохранено' : 'Только на устройстве'}`}
      </Text>
      {ordered ? <Text style={styles.sub}>Проект уже заказан, редактирование недоступно.</Text> : null}
      {notice ? <Text style={styles.sub}>{notice}</Text> : null}
      {draft?.layout?.pages?.length ? <BookTabs value={tab} onChange={goTab} /> : null}
      {draft?.layout?.pages?.length && tab === 'cover' ? (
        <View style={styles.coverTab}>
          <CoverView
            title={coverTitle(draft.layout, draft.project.title)}
            subtitle={draft.layout.cover?.subtitle}
            page={coverPage(draft.layout)}
            sourceOf={sourceOf}
            theme={themeById(draft.layout.themeId)}
            color={draft.layout.cover?.color}
            width={Math.min(winW - space[4] * 2, 280)}
            height={Math.min(winW - space[4] * 2, 280)}
          />
          <Text style={styles.cardTitle}>Обложка фотокниги</Text>
          {!ordered ? (
            <>
              <CoverColors
                value={draft.layout.cover?.color}
                onChange={(color) => setLayout(setCover(draft.layout, { color }, draft.project.title))}
              />
              <Button title="Редактировать обложку" onPress={() => setEditingCover(true)} />
              <Button title={showThemes ? 'Скрыть оформление' : 'Оформление'} variant="secondary" onPress={() => setShowThemes((v) => !v)} />
              {showThemes ? (
                <ThemePicker
                  value={themeById(draft.layout.themeId).id}
                  onChange={(themeId) => setLayout(setTheme(draft.layout, themeId))}
                />
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
      {draft?.layout?.pages?.length ? (
        <View style={tab === 'spread' ? styles.spreadTab : styles.hidden}>
          <BookViewer
            title={draft.project.title}
            layout={draft.layout}
            sourceOf={sourceOf}
            theme={themeById(draft.layout.themeId)}
            onOpenPage={ordered ? undefined : (pageIndex, rect) => setEditing({ pageIndex, rect })}
            onIndexChange={onIndexChange}
            jumpTo={jump}
          />
          <Text style={styles.cardTitle}>
            {viewIndex === 0 ? 'Первая страница' : `Разворот ${spreadRange(viewIndex, pageCount)}`} · {spreadPhotoCount(draft.layout, viewIndex)} фото
          </Text>
          <Text style={styles.hint}>Листайте свайпом или стрелками. Нажмите на страницу, чтобы править её.</Text>
          {!ordered ? (
            <>
              <Button
                title="Редактировать разворот"
                onPress={() => {
                  // Первая страница (разворот 0) правится в редакторе страницы, развороты — на экране расстановки фото.
                  if (viewIndex === 0) {
                    setEditing({ pageIndex: 0, rect: { x: winW / 2 - 80, y: winH / 2 - 80, width: 160, height: 160 } });
                    return;
                  }
                  router.push({ pathname: '/project/[id]/place', params: { id: String(id), spread: String(viewIndex) } });
                }}
              />
              {viewIndex >= 1 ? (
                <Button
                  title="Шаблоны разворота"
                  variant="secondary"
                  onPress={() =>
                    router.push({ pathname: '/project/[id]/spread-templates', params: { id: String(id), spread: String(viewIndex) } })
                  }
                />
              ) : null}
            </>
          ) : null}
        </View>
      ) : null}
      {draft?.layout?.pages?.length && tab === 'pages' ? (
        <View style={styles.pagesTab}>
          <PagesGrid
            layout={draft.layout}
            projectTitle={draft.project.title}
            sourceOf={sourceOf}
            theme={themeById(draft.layout.themeId)}
            issues={issues}
            currentIndex={viewIndex}
            onSelect={(index, kind) => {
              if (kind === 'cover') {
                setTab('cover');
                return;
              }
              setViewIndex(index);
              setJump({ index, key: Date.now() });
              setTab('spread');
            }}
          />
          <Text style={styles.cardTitle}>
            {issues.some((list) => list.length > 0) ? 'Есть что поправить' : 'Всё на своих местах'}
          </Text>
          <Text style={styles.hint}>
            {pageCount} стр. · {photoMap.size} фото
          </Text>
          {!ordered ? (
            <Button
              title="+ Добавить разворот"
              variant="secondary"
              disabled={pageCount + 2 > limits.max}
              onPress={() => setLayout(addSpread(draft.layout, limits.max))}
            />
          ) : null}
        </View>
      ) : null}
      {draft?.project.id === id && photoList.length > 0 ? (
        <Button title="PicPac Time Machine" variant="secondary"
          onPress={() => router.push({ pathname: '/project/[id]/preview', params: { id: String(id), mode: 'time-machine' } })} />
      ) : null}
      {draft && draft.project.id === id && !ordered && photoList.length > 0 ? (
        confirmTimeline ? (
          <>
            <Text style={styles.hint}>{tr('Пересборка заменит текущий макет. Фотографии останутся в проекте.')}</Text>
            <Button title={tr('Пересобрать книгу по датам')} onPress={() => {
              const { layout } = buildTimeMachineLayout(photoList.map((photo) => ({ ...photo, authorName: null })), {
                title: draft.project.title, limits: { pagesMin: limits.min, pagesMax: limits.max },
              });
              setLayout(markSeen({ ...layout, themeId: draft.layout.themeId }, photoList.map((photo) => photo.id)));
              setConfirmTimeline(false);
              setJump({ index: 0, key: Date.now() });
              setTab('spread');
            }} />
            <Button title="Отмена" variant="secondary" onPress={() => setConfirmTimeline(false)} />
          </>
        ) : <Button title={tr('Разложить по датам')} variant="text" onPress={() => setConfirmTimeline(true)} />
      ) : null}
      <Button
        title="Смотреть результат"
        variant="secondary"
        disabled={busy || !draft?.layout?.pages?.length}
        onPress={() => router.push({ pathname: '/project/[id]/preview', params: { id: String(id) } })}
      />
      <Button
        title={`Проверить${pageCount > 0 && quote.data ? ` · ${formatByn(goodsPriceKop(quote.data))}` : ''}`}
        disabled={busy}
        onPress={() => router.push(`/project/${id}/review`)}
      />
      {pageCount > 0 ? (
        <Text style={styles.hint}>
          {pageCount} стр.{quote.stale ? ' · цена обновляется' : ''}
        </Text>
      ) : null}
      {editingCover && draft?.layout ? (
        <CoverEditor
          layout={draft.layout}
          projectTitle={draft.project.title}
          photos={photoList}
          photoUpload={photoUpload}
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
          photoUpload={photoUpload}
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
  coverTab: { gap: space[3], alignItems: 'center' },
  spreadTab: { gap: space[3] },
  pagesTab: { gap: space[3] },
  hidden: { display: 'none' },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginVertical: space[2] },
});
