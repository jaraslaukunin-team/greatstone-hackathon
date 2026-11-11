import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { lightColors, radius, touch, typography } from '../theme/theme';
import { Icon, type IconName } from './Icon';

/**
 * primary — красная (Action Color #DD5757)
 * dark — тёмно-зелёная (Action Color #364C49)
 * secondary — белая с рамкой
 * text — без подложки
 */
type Variant = 'primary' | 'dark' | 'secondary' | 'text';

type Props = PressableProps & {
  title: string;
  variant?: Variant;
  icon?: IconName;
};

export function Button({ title, variant = 'primary', icon, disabled, style, ...rest }: Props) {
  const c = lightColors;

  function paint(pressed: boolean) {
    if (disabled && variant !== 'text') return { bg: c.disabledBg, fg: c.disabledText, border: c.disabledBg };
    switch (variant) {
      case 'primary':
        return { bg: pressed ? c.accentPressed : c.accent, fg: c.textOnAccent, border: 'transparent' };
      case 'dark':
        return { bg: pressed ? c.actionPressed : c.action, fg: '#FFFFFF', border: 'transparent' };
      case 'secondary':
        return { bg: pressed ? c.fillSand : c.surface, fg: c.text, border: c.borderStrong };
      default:
        return { bg: pressed ? c.fillSand : 'transparent', fg: disabled ? c.disabledText : c.text, border: 'transparent' };
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      style={(state) => {
        const p = paint(state.pressed);
        return [
          styles.base,
          { backgroundColor: p.bg, borderColor: p.border },
          typeof style === 'function' ? style(state) : style,
        ];
      }}
      {...rest}
    >
      {({ pressed }) => {
        const fg = paint(pressed).fg;
        return (
          <>
            {icon ? <Icon name={icon} size={22} color={fg} /> : null}
            <Text style={[styles.title, { color: fg }]}>{title}</Text>
          </>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.buttonHeight,
    borderRadius: radius.button,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    ...typography.button,
  },
});
