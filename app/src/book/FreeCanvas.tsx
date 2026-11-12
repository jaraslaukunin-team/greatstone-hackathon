import type { BookTheme, Layout } from '@picpac/shared';
import { useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { lightColors } from '../theme/theme';
import type { SourceOf } from './imageSource';
import { frameRect, moveAcrossFold, resizeKeepAspect, setFrame, type LayerRef } from './layers';
import { PageView } from './PageView';
import { bleedRect } from './safeZones';
import { TEXT_STYLES } from './textStyles';

type Props = {
  layout: Layout;
  /** Страницы разворота слева направо (одна или две). */
  pageIndexes: number[];
  selected: LayerRef | null;
  onSelect(ref: LayerRef | null): void;
  onChange(layout: Layout): void;
  sourceOf: SourceOf;
  theme: BookTheme;
  pageW: number;
  pageWidthCm: number;
  /** Только просмотр (заказанный проект). */
  disabled?: boolean;
};

type Box = { left: number; top: number; width: number; height: number; rotate: number };

const HANDLE = 44;

/** Положение слоя в пикселях страницы: у фото рамка, у подписи прямоугольник вокруг центра. */
function boxOf(layout: Layout, ref: LayerRef, pageW: number): Box | null {
  const page = layout.pages[ref.pageIndex];
  if (!page) return null;
  if (ref.kind === 'cell') {
    const f = page.cells[ref.index]?.frame;
    return f ? frameRect(f, pageW, pageW) : null;
  }
  const t = page.texts?.[ref.index];
  if (!t) return null;
  const size = (TEXT_STYLES[t.style]?.size ?? 0.05) * pageW;
  const width = pageW * 0.8;
  const height = size * 1.5;
  return { left: t.x * pageW - width / 2, top: t.y * pageW - height / 2, width, height, rotate: t.rot ?? 0 };
}

const isLockedRef = (layout: Layout, ref: LayerRef) => {
  const page = layout.pages[ref.pageIndex];
  return Boolean(ref.kind === 'cell' ? page?.cells[ref.index]?.locked : page?.texts?.[ref.index]?.locked);
};

/** Разворот со свободными слоями: тап выбирает слой, перетаскивание двигает, угловой маркер меняет размер. */
export function FreeCanvas({ layout, pageIndexes, selected, onSelect, onChange, sourceOf, theme, pageW, pageWidthCm, disabled }: Props) {
  const latest = useRef({ layout, selected, pageIndexes, pageW, onSelect, onChange, disabled });
  latest.current = { layout, selected, pageIndexes, pageW, onSelect, onChange, disabled };
  const start = useRef<{ layout: Layout; ref: LayerRef; x: number; y: number; w: number } | null>(null);

  const grab = () => {
    const { layout: l, selected: ref, pageW: pw } = latest.current;
    if (!ref) return false;
    const page = l.pages[ref.pageIndex];
    const frame = ref.kind === 'cell' ? page?.cells[ref.index]?.frame : undefined;
    const text = ref.kind === 'text' ? page?.texts?.[ref.index] : undefined;
    const x = frame ? frame.x : (text?.x ?? 0);
    const y = frame ? frame.y : (text?.y ?? 0);
    start.current = { layout: l, ref, x, y, w: (frame?.w ?? 0.4) * pw };
    return true;
  };
  const canEdit = () => {
    const { layout: l, selected: ref, disabled: off } = latest.current;
    return !off && !!ref && !isLockedRef(l, ref);
  };

  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canEdit(),
        onMoveShouldSetPanResponder: () => canEdit(),
        onPanResponderGrant: () => {
          grab();
        },
        onPanResponderMove: (_e, g) => {
          const s = start.current;
          if (!s) return;
          const pw = latest.current.pageW;
          latest.current.onChange(setFrame(s.layout, s.ref, { x: s.x + g.dx / pw, y: s.y + g.dy / pw }));
        },
        onPanResponderRelease: (_e, g) => {
          const s = start.current;
          start.current = null;
          if (!s) return;
          const { pageIndexes: pages, pageW: pw } = latest.current;
          const x = s.x + g.dx / pw;
          const at = pages.indexOf(s.ref.pageIndex);
          const neighbor = x > 1 ? pages[at + 1] : x < 0 ? pages[at - 1] : undefined;
          if (neighbor === undefined) return;
          // Центр ушёл за сгиб: слой переходит на соседнюю страницу.
          const moved = moveAcrossFold(setFrame(s.layout, s.ref, { x, y: s.y + g.dy / pw }), s.ref, neighbor, x);
          latest.current.onChange(moved.layout);
          latest.current.onSelect(moved.ref);
        },
      }),
    // Обработчики читают свежие значения из latest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const resize = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canEdit(),
        onMoveShouldSetPanResponder: () => canEdit(),
        onPanResponderGrant: () => {
          grab();
        },
        onPanResponderMove: (_e, g) => {
          const s = start.current;
          if (!s || s.w <= 0) return;
          latest.current.onChange(resizeKeepAspect(s.layout, s.ref, (s.w + (g.dx + g.dy) / 2) / s.w));
        },
        onPanResponderRelease: () => {
          start.current = null;
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const bleed = bleedRect(pageW, pageW, pageWidthCm);
  const selBox = selected ? boxOf(layout, selected, pageW) : null;

  return (
    <View style={styles.row}>
      {pageIndexes.map((pi) => {
        const page = layout.pages[pi];
        const layers: LayerRef[] = [
          ...(page?.cells ?? []).flatMap((c, index): LayerRef[] => (c.frame && !c.hidden ? [{ kind: 'cell', pageIndex: pi, index }] : [])),
          ...(page?.texts ?? []).flatMap((t, index): LayerRef[] => (!t.hidden ? [{ kind: 'text', pageIndex: pi, index }] : [])),
        ];
        return (
          <View key={pi} style={{ width: pageW, height: pageW }}>
            <PageView page={page ?? null} sourceOf={sourceOf} width={pageW} height={pageW} theme={theme} />
            <View pointerEvents="none" style={[styles.safe, { left: bleed.x, top: bleed.y, width: bleed.width, height: bleed.height }]} />
            <Pressable accessibilityLabel="Снять выделение" onPress={() => onSelect(null)} style={StyleSheet.absoluteFill} />
            {layers.map((ref) => {
              const box = boxOf(layout, ref, pageW);
              if (!box) return null;
              const on = selected?.kind === ref.kind && selected.pageIndex === ref.pageIndex && selected.index === ref.index;
              if (on) return null;
              return (
                <Pressable
                  key={`${ref.kind}${ref.index}`}
                  accessibilityRole="button"
                  accessibilityLabel={ref.kind === 'text' ? 'Подпись' : 'Фото'}
                  onPress={() => onSelect(ref)}
                  style={[styles.hit, { left: box.left, top: box.top, width: box.width, height: box.height, transform: [{ rotate: `${box.rotate}deg` }] }]}
                />
              );
            })}
          </View>
        );
      })}
      {selected && selBox ? (
        <View
          pointerEvents="box-none"
          style={[styles.overlay, { left: pageW * pageIndexes.indexOf(selected.pageIndex) + selBox.left, top: selBox.top, width: selBox.width, height: selBox.height, transform: [{ rotate: `${selBox.rotate}deg` }] }]}
        >
          <View {...drag.panHandlers} accessibilityLabel="Выбранный слой" style={[StyleSheet.absoluteFill, styles.selected, isLockedRef(layout, selected) && styles.locked]} />
          {selected.kind === 'cell' && !disabled && !isLockedRef(layout, selected) ? (
            <View {...resize.panHandlers} accessibilityLabel="Изменить размер" style={styles.handle}>
              <View style={styles.handleDot} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 0, position: 'relative' },
  safe: { position: 'absolute', borderWidth: 0.6, borderStyle: 'dashed', borderColor: '#D5D4CA' },
  hit: { position: 'absolute' },
  overlay: { position: 'absolute' },
  selected: { borderWidth: 1.6, borderColor: lightColors.accent },
  locked: { borderStyle: 'dashed', opacity: 0.8 },
  handle: { position: 'absolute', right: -HANDLE / 2, bottom: -HANDLE / 2, width: HANDLE, height: HANDLE, alignItems: 'center', justifyContent: 'center' },
  handleDot: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: lightColors.accent },
});
