import { aspectValue } from '@picpac/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Slider } from '../../ui/Slider';
import { lightColors, radius, space, typography } from '../../theme/theme';
import type { CropRect, Rotation } from '../editState';
import { cropForAspect, FULL_CROP } from '../geometry';
import type { TabProps } from './types';

const ASPECTS = [
  { id: 'full', label: 'Оригинал', value: null },
  { id: '1:1', label: '1:1', value: aspectValue('1:1') },
  { id: '4:3', label: '4:3', value: aspectValue('4:3') },
  { id: '3:2', label: '3:2', value: aspectValue('3:2') },
  { id: '16:9', label: '16:9', value: aspectValue('16:9') },
  { id: '5:7', label: '5:7', value: aspectValue('5:7') },
] as const;

/** Обрезка по пропорциям, положение рамки, поворот на 90° и отражение. */
export function CropTab({ state, srcW, srcH, dispatch }: TabProps) {
  const [aspectId, setAspectId] = useState<string>('full');
  const [offset, setOffset] = useState(50);

  // Пропорции относятся к тому, что видно на экране: после поворота на 90° стороны меняются.
  function cropFor(id: string, offsetPct: number, rotation: Rotation): CropRect {
    const a = ASPECTS.find((x) => x.id === id);
    if (!a || a.value === null) return { ...FULL_CROP };
    const quarter = rotation === 90 || rotation === 270;
    return cropForAspect(srcW, srcH, quarter ? 1 / a.value : a.value, offsetPct / 100);
  }

  function pick(id: string) {
    setAspectId(id);
    dispatch({ type: 'commit', patch: { crop: cropFor(id, offset, state.rotation) } });
  }

  function rotate() {
    const rotation = ((state.rotation + 90) % 360) as Rotation;
    dispatch({ type: 'commit', patch: { rotation, crop: cropFor(aspectId, offset, rotation) } });
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Пропорции</Text>
      <View style={styles.row}>
        {ASPECTS.map((a) => (
          <Pressable
            key={a.id}
            accessibilityRole="button"
            accessibilityState={{ selected: aspectId === a.id }}
            onPress={() => pick(a.id)}
            style={[styles.chip, aspectId === a.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, aspectId === a.id && styles.chipTextOn]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      {aspectId !== 'full' ? (
        <Slider
          label="Положение рамки"
          value={offset}
          min={0}
          max={100}
          step={1}
          format={(v) => `${v}%`}
          onChange={(v) => {
            setOffset(v);
            dispatch({ type: 'preview', patch: { crop: cropFor(aspectId, v, state.rotation) } });
          }}
          onCommit={(v) => dispatch({ type: 'commit', patch: { crop: cropFor(aspectId, v, state.rotation) } })}
        />
      ) : null}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={rotate} style={styles.chip}>
          <Text style={styles.chipText}>Повернуть на 90°</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: state.flipX }} onPress={() => dispatch({ type: 'commit', patch: { flipX: !state.flipX } })} style={[styles.chip, state.flipX && styles.chipOn]}>
          <Text style={[styles.chipText, state.flipX && styles.chipTextOn]}>Отразить</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[3] },
  label: { ...typography.label, color: lightColors.textSecondary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { minHeight: 44, minWidth: 44, paddingHorizontal: space[3], borderRadius: radius.button, borderWidth: 1.5, borderColor: lightColors.borderStrong, backgroundColor: lightColors.surface, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: lightColors.action, borderColor: lightColors.action },
  chipText: { ...typography.bodyStrong, color: lightColors.text },
  chipTextOn: { color: '#FFFFFF' },
});
