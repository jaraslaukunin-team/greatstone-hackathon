import type { PageText } from '@picpac/shared';
import { useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { lightColors } from '../theme/theme';
import { clampTextPos, textBox } from './textBox';

type Props = {
  texts: PageText[];
  width: number;
  height: number;
  /** Индекс выбранной надписи; null — ничего не выбрано. */
  selected: number | null;
  onSelect(index: number | null): void;
  /** Новое положение центра надписи в долях страницы (во время перетаскивания). */
  onMove(index: number, x: number, y: number): void;
  /** Только просмотр: надписи нельзя выбрать и двигать. */
  disabled?: boolean;
};

/**
 * Слой поверх страницы: нажатие выбирает надпись, перетаскивание выбранной двигает её куда угодно в пределах страницы.
 * Пустые места слоя не перехватывают касания, поэтому ячейки с фото под ним продолжают работать.
 */
export function TextLayer({ texts, width, height, selected, onSelect, onMove, disabled }: Props) {
  const latest = useRef({ texts, width, height, selected, onMove, disabled });
  latest.current = { texts, width, height, selected, onMove, disabled };
  const start = useRef<{ index: number; x: number; y: number } | null>(null);

  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => {
          const s = latest.current;
          const t = s.selected === null ? undefined : s.texts[s.selected];
          return !s.disabled && !!t && !t.locked;
        },
        onMoveShouldSetPanResponder: () => {
          const s = latest.current;
          const t = s.selected === null ? undefined : s.texts[s.selected];
          return !s.disabled && !!t && !t.locked;
        },
        onPanResponderGrant: () => {
          const s = latest.current;
          const t = s.selected === null ? undefined : s.texts[s.selected];
          start.current = s.selected !== null && t ? { index: s.selected, x: t.x, y: t.y } : null;
        },
        onPanResponderMove: (_e, g) => {
          const st = start.current;
          if (!st) return;
          const { width: w, height: h, onMove: move } = latest.current;
          const p = clampTextPos(st.x + g.dx / w, st.y + g.dy / h);
          move(st.index, p.x, p.y);
        },
        onPanResponderRelease: () => {
          start.current = null;
        },
        onPanResponderTerminate: () => {
          start.current = null;
        },
      }),
    [],
  );

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {texts.map((t, i) => {
        if (t.hidden) return null;
        const b = textBox(t, width, height);
        const on = selected === i;
        const pos = { position: 'absolute' as const, left: b.left, top: b.top, width: b.width, height: b.height };
        const rot = t.rot ? { transform: [{ rotate: `${t.rot}deg` }] } : null;
        if (on) {
          return (
            <View
              key={i}
              {...drag.panHandlers}
              accessibilityLabel={`Надпись ${i + 1}, выбрана`}
              style={[pos, rot, styles.selected]}
            />
          );
        }
        return (
          <Pressable
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Надпись ${i + 1}`}
            disabled={disabled}
            onPress={() => onSelect(i)}
            style={[pos, rot]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  selected: { borderWidth: 1.5, borderColor: lightColors.accent, borderStyle: 'dashed', borderRadius: 4, backgroundColor: 'rgba(235,87,87,0.08)' },
});
