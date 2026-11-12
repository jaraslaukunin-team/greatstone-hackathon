import { Pressable, StyleSheet, View } from 'react-native';
import { lightColors } from '../theme/theme';
import { COVER_COLORS } from './cover';

type Props = {
  /** Выбранный цвет (Cover.color); undefined — цвет темы. */
  value: string | undefined;
  onChange(color: string): void;
  disabled?: boolean;
};

/** Четыре цвета ткани обложки кружками; зона касания 44×44. */
export function CoverColors({ value, onChange, disabled }: Props) {
  return (
    <View style={styles.row}>
      {COVER_COLORS.map((color) => {
        const selected = value === color;
        return (
          <Pressable
            key={color}
            accessibilityRole="button"
            accessibilityLabel={`Цвет обложки ${color}`}
            accessibilityState={{ selected, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange(color)}
            style={styles.hit}
          >
            <View style={[styles.dot, { backgroundColor: color }, selected && styles.dotOn]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: lightColors.border },
  dotOn: { borderColor: lightColors.accent, borderWidth: 2.5 },
});
