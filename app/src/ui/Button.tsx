import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { lightColors, radius, touch, typography } from '../theme/theme';

type Variant = 'primary' | 'secondary' | 'text';

type Props = PressableProps & {
  title: string;
  variant?: Variant;
};

export function Button({ title, variant = 'primary', disabled, style, ...rest }: Props) {
  const colors = lightColors;
  const backgroundColor =
    variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.surfaceMuted : 'transparent';
  const color = variant === 'primary' ? '#FFFFFF' : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor,
          opacity: disabled || state.pressed ? 0.7 : 1,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.border,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <Text style={[styles.title, { color }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.buttonHeight,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  title: {
    ...typography.bodyStrong,
  },
});
