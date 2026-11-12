import { useLayoutEffect, useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Во время движения: для предпросмотра, в историю не пишется. */
  onChange(value: number): void;
  /** Палец отпущен или нажата кнопка «−»/«+»: значение окончательное. */
  onCommit(value: number): void;
  format?(value: number): string;
};

type Measurable = { measureInWindow(cb: (x: number, y: number, w: number, h: number) => void): void };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Ползунок: тянется пальцем и мышью, а для тех, кому жест неудобен, есть кнопки «−» и «+». */
export function Slider({ label, value, min, max, step = 1, onChange, onCommit, format }: Props) {
  const track = useRef<Measurable | null>(null);
  const box = useRef({ left: 0, width: 1 });
  const latest = useRef(value);
  useLayoutEffect(() => { latest.current = value; });
  // Обработчики жеста создаются один раз, поэтому свежие значения берут из ref.
  const cfg = useRef({ min, max, step, onChange, onCommit });
  useLayoutEffect(() => { cfg.current = { min, max, step, onChange, onCommit }; });

  const pan = useMemo(() => {
    const valueAt = (pageX: number) => {
      const { min: lo, max: hi, step: st } = cfg.current;
      const t = clamp((pageX - box.current.left) / box.current.width, 0, 1);
      return clamp(Math.round((lo + t * (hi - lo)) / st) * st, lo, hi);
    };
    const move = (pageX: number) => {
      const v = valueAt(pageX);
      if (v !== latest.current) {
        latest.current = v;
        cfg.current.onChange(v);
      }
    };
    // eslint-disable-next-line react-hooks/refs -- PanResponder.create registers these callbacks and reads the refs only during gestures.
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const pageX = e.nativeEvent.pageX;
        track.current?.measureInWindow((x, _y, w) => {
          box.current = { left: x, width: w || 1 };
          move(pageX);
        });
      },
      onPanResponderMove: (e) => move(e.nativeEvent.pageX),
      onPanResponderRelease: () => cfg.current.onCommit(latest.current),
      onPanResponderTerminate: () => cfg.current.onCommit(latest.current),
    });
  }, []);

  function nudge(dir: 1 | -1) {
    const v = clamp(value + dir * step, min, max);
    onChange(v);
    onCommit(v);
  }

  const fraction = max > min ? (clamp(value, min, max) - min) / (max - min) : 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{format ? format(value) : String(value)}</Text>
      </View>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: меньше`} onPress={() => nudge(-1)} style={styles.nudge}>
          <Text style={styles.nudgeText}>−</Text>
        </Pressable>
        <View
          ref={track as never}
          collapsable={false}
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min, max, now: value }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
          style={styles.hit}
          {...pan.panHandlers}
        >
          <View style={styles.track} pointerEvents="none">
            <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
          </View>
          <View style={[styles.thumb, { left: `${fraction * 100}%` }]} pointerEvents="none" />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: больше`} onPress={() => nudge(1)} style={styles.nudge}>
          <Text style={styles.nudgeText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1] },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { ...typography.caption, color: lightColors.textSecondary },
  value: { ...typography.label, color: lightColors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  nudge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  nudgeText: { ...typography.h2, color: lightColors.text, lineHeight: 28 },
  hit: { flex: 1, height: 44, justifyContent: 'center' },
  track: { height: 6, borderRadius: radius.pill, backgroundColor: lightColors.border, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: lightColors.accent },
  thumb: { position: 'absolute', width: 24, height: 24, marginLeft: -12, borderRadius: 12, backgroundColor: lightColors.accent, borderWidth: 3, borderColor: lightColors.surface },
});
