import { HeaderEdge } from '../ui/HeaderEdge';
import type { BookTheme, Cell, Layout, Page, PhotoDTO, Rect } from '@picpac/shared';
import { useLayoutEffect, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  addPageText,
  applyTemplate,
  clearPhoto,
  insertPage,
  MAX_PAGE_TEXTS,
  removePage,
  removePageText,
  replacePhoto,
  setCrop,
  setFit,
  setPageBg,
  swapCells,
  updatePageText,
  type CellRef,
} from '../editor/editorActions';
import { Slider } from '../ui/Slider';
import { lightColors, radius, space, typography } from '../theme/theme';
import { cellRects } from './cellRects';
import { clampCrop } from './cropMath';
import type { SourceOf } from './imageSource';
import { PageView } from './PageView';
import { bleedRect, foldBandWidth } from './safeZones';
import { TEXT_STYLES, TEXT_STYLE_IDS } from './textStyles';

type Props = {
  pageIndex: number;
  layout: Layout;
  /** Все фото проекта: из них выбирается замена. */
  photos: PhotoDTO[];
  sourceOf: SourceOf;
  photoUpload?: React.ReactNode;
  theme: BookTheme;
  /** Прямоугольник страницы в окне: правка «вырастает» из него. */
  originRect: Rect;
  pagesMin: number;
  pagesMax: number;
  /** Ширина страницы в см: по ней считаются зоны обреза и сгиба. */
  pageWidthCm: number;
  onChange(layout: Layout): void;
  /** Открыть фоторедактор для фото ячейки; кнопка скрыта, если обработчика нет. */
  onOpenPhotoEditor?(photoId: string, ref: CellRef): void;
  /** Можно ли править это фото (участник альбома правит только свои). По умолчанию можно. */
  canEditPhoto?(photo: PhotoDTO): boolean;
  onClose(): void;
  onGoto(pageIndex: number): void;
};

const TEMPLATES: { id: Page['template']; label: string }[] = [
  { id: 'one', label: '1 фото' },
  { id: 'two', label: '2 фото' },
  { id: 'three', label: '3 фото' },
  { id: 'four', label: '4 фото' },
  { id: 'spread-one', label: 'Во всю страницу' },
];
// Фоны страницы: оттенки из палитры брендбука; «Как в теме» возвращает цвет темы.
const PAGE_BACKGROUNDS = [lightColors.surface, lightColors.fillRose, lightColors.fillSand, lightColors.fillMint, lightColors.fillSky, lightColors.fillLilac];

/** Короткий отклик при захвате и обмене фото; на вебе и там, где вибрации нет, молча ничего не делает. */
function buzz() {
  void Haptics.selectionAsync().catch(() => undefined);
}
const OPEN_MS = 280;
const ZOOM_STEP = 0.25;

type Live = { cellIndex: number; crop: Cell['crop'] };

/**
 * Режим правки одной страницы поверх книги: раскладка, замена фото, кадр жестами, «целиком/заполнить»,
 * обмен ячеек, страницы туда-сюда. Все изменения уходят наверх через onChange; сохранение — забота экрана.
 */
export function PageEditor(props: Props) {
  const { pageIndex, layout, photos, sourceOf, theme, originRect, pagesMin, pagesMax, onChange, onClose, onGoto } = props;
  const { width: winW, height: winH } = useWindowDimensions();
  const page = layout.pages[pageIndex];
  const size = Math.round(Math.min(winW - space[4] * 2, winH * 0.44, 520));
  const target = { x: (winW - size) / 2, y: 92, size };

  const [selected, setSelected] = useState<number | null>(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const [live, setLive] = useState<Live | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => undefined);
  }, []);
  useEffect(() => {
    if (reduceMotion) progress.setValue(1);
    else Animated.timing(progress, { toValue: 1, duration: OPEN_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [progress, reduceMotion]);
  const [previousPage, setPreviousPage] = useState(pageIndex);
  if (previousPage !== pageIndex) {
    setPreviousPage(pageIndex);
    setSelected(null);
    setShowPhotos(false);
    setLive(null);
  }

  const rects = useMemo(
    () => (page ? cellRects(page.template, size, size, page.cells.length, theme, page.gap) : []),
    [page, size, theme],
  );

  // Актуальное состояние для обработчиков жестов (PanResponder создаётся один раз).
  const state = useRef({ page, selected, rects, layout, pageIndex, sourceOf, onChange });
  useLayoutEffect(() => { state.current = { page, selected, rects, layout, pageIndex, sourceOf, onChange }; });
  const gesture = useRef<{ start: Cell['crop']; startDist: number | null; startScale: number } | null>(null);

  function cropFor(cellIndex: number, proposal: Cell['crop']): Cell['crop'] | null {
    const s = state.current;
    const cell = s.page?.cells[cellIndex];
    const rect = s.rects[cellIndex];
    const info = cell?.photoId ? s.sourceOf(cell.photoId) : null;
    if (!cell || !rect || !info) return null;
    return clampCrop(info, rect, cell.fit ?? 'contain', proposal);
  }

  function commitCrop(cellIndex: number, proposal: Cell['crop']) {
    const next = cropFor(cellIndex, proposal);
    if (!next) return;
    const s = state.current;
    s.onChange(setCrop(s.layout, { pageIndex: s.pageIndex, cellIndex }, next));
  }

  const pan = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- PanResponder.create registers these callbacks and reads the refs only during gestures.
      PanResponder.create({
        // Тап проходит к кнопке ячейки; жест начинается, только когда палец пошёл.
        onMoveShouldSetPanResponder: (_e, g) => {
          const s = state.current;
          const cell = s.selected === null ? null : s.page?.cells[s.selected];
          return !!cell && cell.fit === 'cover' && (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3);
        },
        onPanResponderGrant: () => {
          const s = state.current;
          const cell = s.selected === null ? null : s.page?.cells[s.selected];
          if (cell) gesture.current = { start: { ...cell.crop }, startDist: null, startScale: cell.crop.scale };
        },
        onPanResponderMove: (e, g) => {
          const s = state.current;
          const g0 = gesture.current;
          const rect = s.selected === null ? undefined : s.rects[s.selected];
          if (!g0 || s.selected === null || !rect) return;
          const touches = e.nativeEvent.touches;
          let proposal: Cell['crop'];
          if (touches && touches.length >= 2) {
            const dist = Math.hypot(touches[0]!.pageX - touches[1]!.pageX, touches[0]!.pageY - touches[1]!.pageY);
            if (g0.startDist === null) {
              g0.startDist = dist;
              g0.startScale = (live && live.cellIndex === s.selected ? live.crop.scale : g0.start.scale);
            }
            proposal = { ...g0.start, scale: g0.startScale * (dist / g0.startDist) };
          } else {
            proposal = { ...g0.start, x: g0.start.x + g.dx / rect.width, y: g0.start.y + g.dy / rect.height };
          }
          const clamped = cropFor(s.selected, proposal);
          if (clamped) {
            setLive((prev) => {
              if (!prev) buzz(); // кадр «взяли»: короткий отклик
              return { cellIndex: s.selected!, crop: clamped };
            });
          }
        },
        onPanResponderRelease: () => finishGesture(),
        onPanResponderTerminate: () => finishGesture(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const liveRef = useRef<Live | null>(null);
  useLayoutEffect(() => { liveRef.current = live; });
  function finishGesture() {
    const l = liveRef.current;
    gesture.current = null;
    setLive(null);
    if (l) commitCrop(l.cellIndex, l.crop);
  }

  // Колесо мыши на вебе: масштаб кадра выбранной ячейки.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = (globalThis as { document?: { getElementById(id: string): HTMLElement | null } }).document?.getElementById('page-editor-cells');
    if (!el) return;
    const onWheel = (ev: WheelEvent) => {
      const s = state.current;
      const cell = s.selected === null ? null : s.page?.cells[s.selected];
      if (!cell || s.selected === null || cell.fit !== 'cover') return;
      ev.preventDefault();
      commitCrop(s.selected, { ...cell.crop, scale: cell.crop.scale * (ev.deltaY < 0 ? 1.1 : 0.9) });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.cells.length]);

  if (!page) return null;

  const cell = selected === null ? undefined : page.cells[selected];
  const cellRef: CellRef | null = selected === null ? null : { pageIndex, cellIndex: selected };
  const cellPhoto = cell?.photoId ? photos.find((p) => p.id === cell.photoId) : undefined;
  const canEdit = !!cellPhoto && (props.canEditPhoto?.(cellPhoto) ?? true);

  // Пока идёт жест, рисуем кадр из live, а в макет пишем один раз при отпускании пальца.
  const viewPage: Page = live
    ? { ...page, cells: page.cells.map((c, i) => (i === live.cellIndex ? { ...c, crop: live.crop } : c)) }
    : page;

  const bleed = bleedRect(size, size, props.pageWidthCm);
  const foldBand = foldBandWidth(size, props.pageWidthCm);
  const s0 = Math.max(0.2, originRect.width / size);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [originRect.x + originRect.width / 2 - (target.x + size / 2), 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [originRect.y + originRect.height / 2 - (target.y + size / 2), 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [s0, 1] });

  function close() {
    if (reduceMotion) return onClose();
    Animated.timing(progress, { toValue: 0, duration: OPEN_MS, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onClose());
  }

  function select(i: number) {
    buzz();
    setSelected(i);
    setShowPhotos(!page!.cells[i]?.photoId);
  }

  function pickPhoto(photoId: string) {
    if (!cellRef) return;
    onChange(replacePhoto(layout, cellRef, photoId));
    setShowPhotos(false);
  }

  function addPage() {
    onChange(insertPage(layout, pageIndex + 1));
    onGoto(pageIndex + 1);
  }

  function deletePage() {
    const next = removePage(layout, pageIndex);
    onChange(next);
    onGoto(Math.min(pageIndex, next.pages.length - 1));
  }

  return (
    <Modal transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.header}>
          <HeaderEdge inside />
          <Pressable accessibilityRole="button" accessibilityLabel="Предыдущая страница" disabled={pageIndex === 0} onPress={() => onGoto(pageIndex - 1)} style={[styles.round, pageIndex === 0 && styles.off]}>
            <Text style={styles.roundText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>
            Страница {pageIndex + 1} из {layout.pages.length}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Следующая страница" disabled={pageIndex >= layout.pages.length - 1} onPress={() => onGoto(pageIndex + 1)} style={[styles.round, pageIndex >= layout.pages.length - 1 && styles.off]}>
            <Text style={styles.roundText}>›</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Готово" onPress={close} style={styles.done}>
            <Text style={styles.doneText}>Готово</Text>
          </Pressable>
        </View>

        <Animated.View
          style={{ position: 'absolute', left: target.x, top: target.y, width: size, height: size, transform: [{ translateX }, { translateY }, { scale }] }}
        >
          <PageView page={viewPage} sourceOf={sourceOf} width={size} height={size} theme={theme} />
          <View nativeID="page-editor-cells" style={StyleSheet.absoluteFill as never} {...pan.panHandlers}>
            {viewPage.cells.map((c, i) => {
              const r = rects[i];
              if (!r) return null;
              return (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={c.photoId ? `Фото ${i + 1}` : `Пустая ячейка ${i + 1}`}
                  onPress={() => select(i)}
                  onLongPress={() => {
                    if (selected !== null && selected !== i) {
                      buzz();
                      onChange(swapCells(layout, { pageIndex, cellIndex: selected }, { pageIndex, cellIndex: i }));
                    }
                  }}
                  style={[{ position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height }, selected === i && styles.cellSelected]}
                >
                  {!c.photoId ? <Text style={styles.plus}>＋</Text> : null}
                </Pressable>
              );
            })}
          </View>
          {live ? (
            // Пока двигаем кадр, показываем, что обрежут при печати и что уйдёт в сгиб у корешка.
            <View pointerEvents="none" style={StyleSheet.absoluteFill as never}>
              <View style={[styles.bleed, { left: bleed.x, top: bleed.y, width: bleed.width, height: bleed.height }]} />
              <View style={[styles.fold, { width: foldBand }, pageIndex % 2 === 1 ? { right: 0 } : { left: 0 }]} />
            </View>
          ) : null}
        </Animated.View>

        <ScrollView style={[styles.panel, { top: target.y + size + space[3] }]} contentContainerStyle={styles.panelContent}>
          <Text style={styles.label}>Раскладка</Text>
          <View style={styles.row}>
            {TEMPLATES.map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                accessibilityState={{ selected: page.template === t.id }}
                onPress={() => onChange(applyTemplate(layout, pageIndex, t.id))}
                style={[styles.chip, page.template === t.id && styles.chipOn]}
              >
                <Text style={[styles.chipText, page.template === t.id && styles.chipTextOn]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Фон страницы</Text>
          <View style={styles.row}>
            {PAGE_BACKGROUNDS.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={`Фон ${c}`}
                accessibilityState={{ selected: page.bg === c }}
                onPress={() => onChange(setPageBg(layout, pageIndex, c))}
                style={[styles.swatch, { backgroundColor: c }, page.bg === c && styles.swatchOn]}
              />
            ))}
            <Chip label="Как в теме" onPress={() => onChange(setPageBg(layout, pageIndex, null))} disabled={page.bg === undefined} />
          </View>

          <Text style={styles.label}>Подписи</Text>
          <View style={styles.row}>
            {TEXT_STYLE_IDS.map((id) => (
              <Chip
                key={id}
                label={`+ ${TEXT_STYLES[id].label}`}
                onPress={() => onChange(addPageText(layout, pageIndex, { text: TEXT_STYLES[id].sample, x: 0.5, y: 0.88, style: id }))}
                disabled={(page.texts?.length ?? 0) >= MAX_PAGE_TEXTS}
              />
            ))}
          </View>
          {(page.texts ?? []).map((t, i) => (
            <View key={`${i}-${t.style}`} style={styles.textRow}>
              <TextInput
                defaultValue={t.text}
                onEndEditing={(e) => {
                  const text = e.nativeEvent.text.trim();
                  if (text && text !== t.text) onChange(updatePageText(layout, pageIndex, i, { text }));
                }}
                maxLength={120}
                style={styles.input}
                accessibilityLabel={`Текст подписи ${i + 1}`}
              />
              <Slider
                label="Выше / ниже"
                value={Math.round(t.y * 100)}
                min={5}
                max={95}
                step={1}
                format={(v) => `${v}%`}
                onChange={() => undefined}
                onCommit={(v) => onChange(updatePageText(layout, pageIndex, i, { y: v / 100 }))}
              />
              <Chip label="Удалить подпись" onPress={() => onChange(removePageText(layout, pageIndex, i))} />
            </View>
          ))}

          {cell && cellRef ? (
            <>
              <Text style={styles.label}>Фото</Text>
              <View style={styles.row}>
                <Chip label="Заменить" onPress={() => setShowPhotos((v) => !v)} />
                {cell.photoId ? (
                  <Chip
                    label={cell.fit === 'cover' ? 'Целиком' : 'Заполнить'}
                    onPress={() => onChange(setFit(layout, cellRef, cell.fit === 'cover' ? 'contain' : 'cover'))}
                  />
                ) : null}
                {cell.photoId && cell.fit === 'cover' ? (
                  <>
                    <Chip label="−" onPress={() => commitCrop(cellRef.cellIndex, { ...cell.crop, scale: cell.crop.scale - ZOOM_STEP })} />
                    <Chip label="+" onPress={() => commitCrop(cellRef.cellIndex, { ...cell.crop, scale: cell.crop.scale + ZOOM_STEP })} />
                  </>
                ) : null}
                {canEdit && props.onOpenPhotoEditor && cell.photoId ? (
                  <Chip label="Редактор" onPress={() => props.onOpenPhotoEditor?.(cell.photoId!, cellRef)} />
                ) : null}
                {cell.photoId ? <Chip label="Убрать" onPress={() => onChange(clearPhoto(layout, cellRef))} /> : null}
              </View>
              {cell.photoId && cell.fit === 'cover' ? (
                <Text style={styles.hint}>Двигайте кадр пальцем, приближайте двумя пальцами, колесом мыши или кнопками «−» и «+».</Text>
              ) : null}
              {selected !== null && page.cells.length > 1 ? (
                <Text style={styles.hint}>Чтобы поменять фото местами, удерживайте другую ячейку.</Text>
              ) : null}
              {showPhotos ? (
                <>
                {props.photoUpload}
                <ScrollView horizontal contentContainerStyle={styles.strip}>
                  {photos.map((p) => {
                    const info = sourceOf(p.id);
                    return (
                      <Pressable key={p.id} accessibilityRole="button" accessibilityLabel="Поставить это фото" onPress={() => pickPhoto(p.id)}>
                        {info ? <Image source={info.source} style={[styles.thumb, cell.photoId === p.id && styles.thumbOn]} /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                </>
              ) : null}
            </>
          ) : (
            <Text style={styles.hint}>Нажмите на фото, чтобы заменить его или поправить кадр.</Text>
          )}

          <Text style={styles.label}>Страницы</Text>
          <View style={styles.row}>
            <Chip label="+ Страница" onPress={addPage} disabled={layout.pages.length >= pagesMax} />
            <Chip label="Удалить страницу" onPress={deletePage} disabled={layout.pages.length <= pagesMin} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Chip({ label, onPress, disabled }: { label: string; onPress(): void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, disabled && styles.off]}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: lightColors.bg },
  header: { position: 'absolute', top: space[5], left: space[4], right: space[4], height: 52, flexDirection: 'row', alignItems: 'center', gap: space[2] },
  title: { ...typography.bodyStrong, color: lightColors.text, flex: 1, textAlign: 'center' },
  round: { width: 44, height: 44, borderRadius: 22, backgroundColor: lightColors.surface, borderWidth: 1, borderColor: lightColors.border, alignItems: 'center', justifyContent: 'center' },
  roundText: { ...typography.h2, color: lightColors.text, lineHeight: 28 },
  off: { opacity: 0.35 },
  done: { minHeight: 44, paddingHorizontal: space[4], borderRadius: radius.button, backgroundColor: lightColors.accent, alignItems: 'center', justifyContent: 'center' },
  doneText: { ...typography.button, color: lightColors.textOnAccent },
  cellSelected: { borderWidth: 2, borderColor: lightColors.accent },
  plus: { ...typography.h1, color: lightColors.textSecondary, textAlign: 'center', marginTop: '35%' },
  panel: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  panelContent: { padding: space[4], gap: space[2] },
  label: { ...typography.label, color: lightColors.textSecondary, marginTop: space[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { minHeight: 44, minWidth: 44, paddingHorizontal: space[3], borderRadius: radius.button, borderWidth: 1.5, borderColor: lightColors.borderStrong, backgroundColor: lightColors.surface, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: lightColors.action, borderColor: lightColors.action },
  chipText: { ...typography.bodyStrong, color: lightColors.text },
  chipTextOn: { color: '#FFFFFF' },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: lightColors.borderStrong },
  swatchOn: { borderColor: lightColors.accent, borderWidth: 3 },
  textRow: { gap: space[1], padding: space[2], borderRadius: radius.input, backgroundColor: lightColors.surfaceMuted },
  input: { minHeight: 44, paddingHorizontal: space[3], borderRadius: radius.input, borderWidth: 1.5, borderColor: lightColors.borderStrong, backgroundColor: lightColors.surface, color: lightColors.text, ...typography.body },
  bleed: { position: 'absolute', borderWidth: 1, borderStyle: 'dashed', borderColor: lightColors.danger },
  fold: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(221, 87, 87, 0.18)' },
  strip: { gap: space[2], paddingVertical: space[1] },
  thumb: { width: 64, height: 64, borderRadius: radius.photo, backgroundColor: lightColors.border },
  thumbOn: { borderWidth: 2, borderColor: lightColors.accent },
});
