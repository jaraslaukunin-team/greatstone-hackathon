import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Slider } from '../../ui/Slider';
import { lightColors, radius, space, typography } from '../../theme/theme';
import type { Adjust } from '../editState';
import type { TabProps } from './types';

const ROWS: { key: keyof Adjust; label: string }[] = [
  { key: 'brightness', label: 'Яркость' },
  { key: 'contrast', label: 'Контраст' },
  { key: 'saturation', label: 'Насыщенность' },
  { key: 'warmth', label: 'Тепло' },
];

/** Ручные настройки цвета, каждая от −100 до 100. */
export function AdjustTab({ state, dispatch }: TabProps) {
  const changed = ROWS.some((r) => state.adjust[r.key] !== 0);
  return (
    <View style={styles.wrap}>
      {ROWS.map((r) => (
        <Slider
          key={r.key}
          label={r.label}
          value={state.adjust[r.key]}
          min={-100}
          max={100}
          step={1}
          onChange={(v) => dispatch({ type: 'preview', patch: { adjust: { ...state.adjust, [r.key]: v } } })}
          onCommit={(v) => dispatch({ type: 'commit', patch: { adjust: { ...state.adjust, [r.key]: v } } })}
        />
      ))}
      <Pressable
        accessibilityRole="button"
        disabled={!changed}
        onPress={() => dispatch({ type: 'commit', patch: { adjust: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 } } })}
        style={[styles.reset, !changed && styles.off]}
      >
        <Text style={styles.resetText}>Сбросить настройки</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[1] },
  reset: { minHeight: 44, marginTop: space[2], borderRadius: radius.button, borderWidth: 1.5, borderColor: lightColors.borderStrong, backgroundColor: lightColors.surface, alignItems: 'center', justifyContent: 'center' },
  resetText: { ...typography.bodyStrong, color: lightColors.text },
  off: { opacity: 0.4 },
});
