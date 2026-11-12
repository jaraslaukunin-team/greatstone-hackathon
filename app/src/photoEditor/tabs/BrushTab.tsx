import { Pressable, StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../../theme/theme';
import { BRUSH_WIDTHS, EDIT_COLORS } from '../palette';
import type { TabProps } from './types';

export type BrushSettings = { color: string; width: number };
type Props = TabProps & { brush: BrushSettings; onBrush(next: BrushSettings): void };

const WIDTH_LABELS = ['Тонкая', 'Средняя', 'Толстая'];

/** Кисть: цвет и толщина; рисовать — пальцем или мышью по фото, каждый штрих отменяется отдельно. */
export function BrushTab({ state, dispatch, brush, onBrush }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.hint}>Рисуйте по фото пальцем или мышью.</Text>
      <View style={styles.row}>
        {EDIT_COLORS.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Цвет ${c}`}
            accessibilityState={{ selected: brush.color === c }}
            onPress={() => onBrush({ ...brush, color: c })}
            style={[styles.swatch, { backgroundColor: c }, brush.color === c && styles.swatchOn]}
          />
        ))}
      </View>
      <View style={styles.row}>
        {BRUSH_WIDTHS.map((w, i) => (
          <Pressable
            key={w}
            accessibilityRole="button"
            accessibilityState={{ selected: brush.width === w }}
            onPress={() => onBrush({ ...brush, width: w })}
            style={[styles.chip, brush.width === w && styles.chipOn]}
          >
            <Text style={[styles.chipText, brush.width === w && styles.chipTextOn]}>{WIDTH_LABELS[i]}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={state.strokes.length === 0}
        onPress={() => dispatch({ type: 'commit', patch: { strokes: state.strokes.slice(0, -1) } })}
        style={[styles.chip, state.strokes.length === 0 && styles.off]}
      >
        <Text style={styles.chipText}>Убрать последний штрих</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: lightColors.borderStrong },
  swatchOn: { borderColor: lightColors.accent, borderWidth: 3 },
  chip: { minHeight: 44, minWidth: 44, paddingHorizontal: space[3], borderRadius: radius.button, borderWidth: 1.5, borderColor: lightColors.borderStrong, backgroundColor: lightColors.surface, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: lightColors.action, borderColor: lightColors.action },
  chipText: { ...typography.bodyStrong, color: lightColors.text },
  chipTextOn: { color: '#FFFFFF' },
  off: { opacity: 0.4 },
});
