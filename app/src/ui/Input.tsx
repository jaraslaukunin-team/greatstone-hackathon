import { useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import { lightColors, radius, space, touch, typography } from '../theme/theme';

/** Поле ввода: белое, с рамкой Border Color; в фокусе рамка тёмно-зелёная. */
export function Input({ style, onFocus, onBlur, multiline, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={lightColors.textMuted}
      multiline={multiline}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        styles.input,
        multiline && styles.multiline,
        focused && styles.focused,
        // сброс системной обводки браузера — фокус показываем рамкой выше
        { outlineStyle: 'none' } as object,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: touch.min + 8,
    backgroundColor: lightColors.surface,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: lightColors.border,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    ...typography.body,
    color: lightColors.text,
  },
  multiline: { minHeight: 112, textAlignVertical: 'top' },
  focused: { borderColor: lightColors.action },
});
