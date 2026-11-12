import type { CatalogDTO, PhotoDTO, ProjectDTO } from '@picpac/shared';
import { Canvas, useTypeface } from '@shopify/react-native-skia';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Alert, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ApiRequestError } from '../api/client';
import { useApiClient } from '../api/hooks';
import { pickPhotos } from '../photos/pickPhotos';
import { useProjectStore } from '../project/projectStore';
import { lightColors, radius, space, typography } from '../theme/theme';
import { EditScene } from './EditScene';
import { editReducer, initialHistory, type Stroke, type TextItem } from './editState';
import { useEditResult } from './editResultStore';
import { exportEdited } from './export';
import { toFrameFractions } from './geometry';
import { BRUSH_WIDTHS, EDIT_COLORS } from './palette';
import { AdjustTab } from './tabs/AdjustTab';
import { BrushTab, type BrushSettings } from './tabs/BrushTab';
import { CropTab } from './tabs/CropTab';
import { FilterTab } from './tabs/FilterTab';
import { TextTab } from './tabs/TextTab';
import { bytesToUploadUri } from './uploadUri';
import { useSkiaImage } from './useSkiaImage';

type Tab = 'crop' | 'adjust' | 'filter' | 'text' | 'brush';
const TABS: { id: Tab; label: string }[] = [
  { id: 'crop', label: 'Кадр' },
  { id: 'adjust', label: 'Настройки' },
  { id: 'filter', label: 'Фильтры' },
  { id: 'text', label: 'Текст' },
  { id: 'brush', label: 'Кисть' },
];

/** Выйти без сохранения: на вебе window.confirm (Alert там не работает), на телефоне системный диалог. */
function confirmDiscard(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.('Выйти без сохранения?') ?? true);
  return new Promise((resolve) =>
    Alert.alert('Выйти без сохранения?', 'Правки пропадут.', [
      { text: 'Остаться', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Выйти', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function EditorScreen() {
  const params = useLocalSearchParams<{ projectId?: string; photoId?: string; requestId?: string }>();
  const client = useApiClient();
  const { width: winW, height: winH } = useWindowDimensions();
  const [history, dispatch] = useReducer(editReducer, undefined, initialHistory);
  const state = history.present;
  const [projectId, setProjectId] = useState<string | null>(
    typeof params.projectId === 'string' && params.projectId ? params.projectId : null,
  );
  const [photoId, setPhotoId] = useState<string | null>(
    typeof params.photoId === 'string' && params.photoId ? params.photoId : null,
  );
  const [requestId] = useState(
    () => (typeof params.requestId === 'string' && params.requestId ? params.requestId : `edit-${Date.now()}`),
  );
  const [photo, setPhoto] = useState<PhotoDTO | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<Tab>('crop');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [brush, setBrush] = useState<BrushSettings>({ color: EDIT_COLORS[0], width: BRUSH_WIDTHS[1] });

  useEffect(() => {
    if (!projectId || !photoId) return;
    let cancelled = false;
    setLoadError(null);
    client
      .get<PhotoDTO[]>(`/projects/${projectId}/photos`)
      .then((list) => {
        if (cancelled) return;
        const found = list.find((p) => p.id === photoId);
        if (found) setPhoto(found);
        else setLoadError('Фото не найдено');
      })
      .catch(() => !cancelled && setLoadError('Не удалось загрузить фото'));
    return () => {
      cancelled = true;
    };
  }, [client, projectId, photoId]);

  /** Берёт доступный проект или создаёт новый. Старый черновик другого гостя даёт 404 — его сбрасываем. */
  async function ensureProject(): Promise<string> {
    const candidates = [projectId, useProjectStore.getState().draft?.project.id].filter(
      (id): id is string => typeof id === 'string' && id.length > 0,
    );
    for (const id of candidates) {
      try {
        await client.get<ProjectDTO>(`/projects/${id}`);
        setProjectId(id);
        return id;
      } catch (e) {
        if (e instanceof ApiRequestError && e.code === 'NOT_FOUND') continue;
        throw e;
      }
    }
    useProjectStore.getState().clear();
    const catalog = await client.get<CatalogDTO>('/catalog');
    const variantId =
      catalog.products.find((p) => p.kind === 'photobook')?.variants[0]?.id ??
      catalog.products[0]?.variants[0]?.id;
    if (!variantId) throw new Error('Каталог пуст, попробуйте позже');
    const project = await client.post<ProjectDTO>('/projects', {
      variantId,
      title: 'Черновик для редактора',
      isShared: false,
    });
    useProjectStore.getState().setDraft(project);
    setProjectId(project.id);
    return project.id;
  }

  async function onUploadPhoto() {
    setUploading(true);
    setLoadError(null);
    try {
      const picked = await pickPhotos();
      const first = picked[0];
      if (!first) return;
      const pid = await ensureProject();
      const uploaded = await client.upload<PhotoDTO>(`/projects/${pid}/photos`, { uri: first.uri });
      setPhotoId(uploaded.id);
      setPhoto(uploaded);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Не удалось загрузить фото');
    } finally {
      setUploading(false);
    }
  }

  const { image, error: imageError } = useSkiaImage(photo ? client.resolveUrl(photo.url) : null);
  const typeface = useTypeface(require('../../assets/fonts/futura-pt/FuturaPT-Demi.ttf'));

  const srcW = image?.width() ?? photo?.width ?? 1;
  const srcH = image?.height() ?? photo?.height ?? 1;
  const quarter = state.rotation === 90 || state.rotation === 270;
  const frameAspect = (() => {
    const w = Math.max(1, state.crop.w * srcW);
    const h = Math.max(1, state.crop.h * srcH);
    return quarter ? h / w : w / h;
  })();
  const boxW = winW - space[4] * 2;
  const boxH = winH * 0.4;
  const pw = Math.round(boxW / boxH > frameAspect ? boxH * frameAspect : boxW);
  const ph = Math.round(boxW / boxH > frameAspect ? boxH : boxW / frameAspect);

  // Жесты на холсте: кисть рисует штрих, на вкладке «Текст» палец двигает выбранную надпись.
  // base — штрихи до начала жеста: во время рисования present уже содержит недорисованный штрих.
  const live = useRef({
    stroke: null as Stroke | null,
    base: [] as Stroke[],
    textStart: null as { x: number; y: number } | null,
    texts: null as TextItem[] | null,
  });
  const ctx = useRef({ tab, state, brush, selectedText, pw, ph });
  ctx.current = { tab, state, brush, selectedText, pw, ph };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => {
          const c = ctx.current;
          return c.tab === 'brush' || (c.tab === 'text' && c.selectedText !== null);
        },
        onMoveShouldSetPanResponder: () => {
          const c = ctx.current;
          return c.tab === 'brush' || (c.tab === 'text' && c.selectedText !== null);
        },
        onPanResponderGrant: (e) => {
          const c = ctx.current;
          if (c.tab === 'brush') {
            const p = toFrameFractions(e.nativeEvent.locationX, e.nativeEvent.locationY, c.pw, c.ph);
            live.current.base = c.state.strokes;
            live.current.stroke = { color: c.brush.color, width: c.brush.width, points: [p] };
            dispatch({ type: 'preview', patch: { strokes: [...live.current.base, live.current.stroke] } });
          } else {
            const t = c.state.texts.find((x) => x.id === c.selectedText);
            live.current.textStart = t ? { x: t.x, y: t.y } : null;
          }
        },
        onPanResponderMove: (e, g) => {
          const c = ctx.current;
          if (c.tab === 'brush' && live.current.stroke) {
            const p = toFrameFractions(e.nativeEvent.locationX, e.nativeEvent.locationY, c.pw, c.ph);
            live.current.stroke = { ...live.current.stroke, points: [...live.current.stroke.points, p] };
            dispatch({ type: 'preview', patch: { strokes: [...live.current.base, live.current.stroke] } });
          } else if (c.tab === 'text' && live.current.textStart) {
            const start = live.current.textStart;
            const [x, y] = toFrameFractions(start.x * c.pw + g.dx, start.y * c.ph + g.dy, c.pw, c.ph);
            live.current.texts = c.state.texts.map((t) => (t.id === c.selectedText ? { ...t, x, y } : t));
            dispatch({ type: 'preview', patch: { texts: live.current.texts } });
          }
        },
        onPanResponderRelease: () => finishGesture(),
        onPanResponderTerminate: () => finishGesture(),
      }),
    [],
  );
  function finishGesture() {
    const l = live.current;
    if (ctx.current.tab === 'brush' && l.stroke) dispatch({ type: 'commit', patch: { strokes: [...l.base, l.stroke] } });
    else if (ctx.current.tab === 'text' && l.texts) dispatch({ type: 'commit', patch: { texts: l.texts } });
    live.current = { stroke: null, base: [], textStart: null, texts: null };
  }

  const hasChanges = history.past.length > 0;

  async function cancel() {
    if (hasChanges && !(await confirmDiscard())) return;
    router.back();
  }

  async function save() {
    if (!image || !projectId || !hasChanges || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { bytes } = await exportEdited(image, state, typeface);
      const uri = await bytesToUploadUri(bytes);
      const saved = await client.upload<PhotoDTO>(`/projects/${projectId}/photos`, { uri, name: 'edited.jpg', type: 'image/jpeg' });
      useEditResult.getState().set(String(requestId), saved);
      router.back();
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'PROJECT_ORDERED') setLocked(true);
      setSaveError(
        e instanceof ApiRequestError && e.code === 'PROJECT_ORDERED' ? e.message : 'Не удалось сохранить, попробуйте ещё раз. Правки остались на экране.',
      );
    } finally {
      setSaving(false);
    }
  }

  // Нет фото: предлагаем загрузить прямо в редакторе (вход с таба без photoId).
  if (!photo && !photoId) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Редактор фото</Text>
        <Text style={styles.emptySub}>Загрузите фотографию, чтобы кадрировать, настроить цвет и добавить текст.</Text>
        {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Загрузить фотографию"
          disabled={uploading}
          onPress={() => void onUploadPhoto()}
          style={[styles.uploadBtn, uploading && styles.off]}
        >
          <Text style={styles.uploadBtnText}>{uploading ? 'Загружаем…' : 'Загрузить фотографию'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      </View>
    );
  }

  if (loadError || imageError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{loadError ?? 'Не удалось открыть фото'}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void onUploadPhoto()}
          style={styles.uploadBtn}
          disabled={uploading}
        >
          <Text style={styles.uploadBtnText}>Выбрать другое фото</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>Назад</Text>
        </Pressable>
      </View>
    );
  }
  if (!image) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={lightColors.accent} size="large" />
      </View>
    );
  }

  const tabProps = { state, srcW, srcH, dispatch };
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => void cancel()} style={styles.headBtn}>
          <Text style={styles.headText}>Отмена</Text>
        </Pressable>
        <View style={styles.undoRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Отменить действие" disabled={history.past.length === 0} onPress={() => dispatch({ type: 'undo' })} style={[styles.round, history.past.length === 0 && styles.off]}>
            <Text style={styles.roundText}>↶</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Повторить действие" disabled={history.future.length === 0} onPress={() => dispatch({ type: 'redo' })} style={[styles.round, history.future.length === 0 && styles.off]}>
            <Text style={styles.roundText}>↷</Text>
          </Pressable>
        </View>
        {locked ? null : (
          <Pressable accessibilityRole="button" disabled={!hasChanges || saving} onPress={() => void save()} style={[styles.save, (!hasChanges || saving) && styles.off]}>
            <Text style={styles.saveText}>{saving ? 'Сохраняем…' : 'Сохранить'}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.stage}>
        <View style={{ width: pw, height: ph }}>
          <Canvas style={{ width: pw, height: ph }}>
            <EditScene image={image} state={state} width={pw} height={ph} typeface={typeface} />
          </Canvas>
          <View style={StyleSheet.absoluteFill as never} {...pan.panHandlers} accessibilityLabel="Холст" />
        </View>
      </View>
      {saveError ? <Text style={styles.error}>{saveError}</Text> : null}

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        {tab === 'crop' ? <CropTab {...tabProps} /> : null}
        {tab === 'adjust' ? <AdjustTab {...tabProps} /> : null}
        {tab === 'filter' ? <FilterTab {...tabProps} image={image} /> : null}
        {tab === 'text' ? <TextTab {...tabProps} selectedId={selectedText} onSelect={setSelectedText} /> : null}
        {tab === 'brush' ? <BrushTab {...tabProps} brush={brush} onBrush={setBrush} /> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  center: { flex: 1, backgroundColor: lightColors.bg, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[4] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[2] },
  headBtn: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  headText: { ...typography.bodyStrong, color: lightColors.text },
  undoRow: { flexDirection: 'row', gap: space[2] },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: lightColors.surface, borderWidth: 1, borderColor: lightColors.border, alignItems: 'center', justifyContent: 'center' },
  roundText: { ...typography.h3, color: lightColors.text },
  save: { minHeight: 44, paddingHorizontal: space[4], borderRadius: radius.button, backgroundColor: lightColors.accent, alignItems: 'center', justifyContent: 'center' },
  saveText: { ...typography.button, color: lightColors.textOnAccent },
  off: { opacity: 0.4 },
  stage: { alignItems: 'center', justifyContent: 'center', paddingVertical: space[2] },
  error: { ...typography.caption, color: lightColors.danger, paddingHorizontal: space[4], textAlign: 'center' },
  tabs: { flexDirection: 'row', paddingHorizontal: space[2], borderBottomWidth: 1, borderBottomColor: lightColors.border },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: lightColors.accent },
  tabText: { ...typography.caption, color: lightColors.textSecondary },
  tabTextOn: { color: lightColors.text, fontFamily: typography.h3.fontFamily },
  panel: { flex: 1 },
  panelContent: { padding: space[4] },
  back: { minHeight: 44, paddingHorizontal: space[4], borderRadius: radius.button, borderWidth: 1.5, borderColor: lightColors.borderStrong, backgroundColor: lightColors.surface, alignItems: 'center', justifyContent: 'center' },
  backText: { ...typography.bodyStrong, color: lightColors.text },
  emptyTitle: { ...typography.h1, color: lightColors.text, textAlign: 'center' },
  emptySub: { ...typography.body, color: lightColors.textSecondary, textAlign: 'center', maxWidth: 360 },
  uploadBtn: {
    minHeight: 48,
    minWidth: 220,
    paddingHorizontal: space[5],
    borderRadius: radius.button,
    backgroundColor: lightColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: { ...typography.button, color: lightColors.textOnAccent },
});
