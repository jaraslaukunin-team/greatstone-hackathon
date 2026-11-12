import type { PageText, PageTextStyle } from '@picpac/shared';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';
import { TEXT_STYLES, TEXT_STYLE_IDS } from './textStyles';

type Props = {
  text: PageText;
  onChange(patch: Partial<PageText>): void;
  onDelete(): void;
  disabled?: boolean;
};

export const MAX_TEXT_LENGTH = 120;

/** Панель выбранной надписи: поле ввода (несколько строк), стиль и удаление. Положение меняется перетаскиванием на странице. */
export function TextEditorPanel({ text, onChange, onDelete, disabled }: Props) {
  return (
    <View style={styles.panel}>
      <Text style={styles.label}>Текст надписи</Text>
      <TextInput
        value={text.text}
        onChangeText={(v) => onChange({ text: v.slice(0, MAX_TEXT_LENGTH) })}
        editable={!disabled}
        multiline
        maxLength={MAX_TEXT_LENGTH}
        placeholder="Напишите текст"
        accessibilityLabel="Текст надписи"
        style={styles.input}
      />
      <Text style={styles.hint}>
        {text.text.length} / {MAX_TEXT_LENGTH} · перетащите надпись на странице, чтобы переместить
      </Text>
      <View style={styles.row}>
        {TEXT_STYLE_IDS.map((id: PageTextStyle) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: text.style === id, disabled: !!disabled }}
            disabled={disabled}
            onPress={() => onChange({ style: id })}
            style={[styles.chip, text.style === id && styles.chipOn]}
          >
            <Text style={[styles.chipText, text.style === id && styles.chipTextOn]}>{TEXT_STYLES[id].label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onDelete} style={[styles.delete, disabled && styles.off]}>
        <Text style={styles.deleteText}>Удалить надпись</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space[2], backgroundColor: lightColors.surface, borderRadius: radius.photo * 2, padding: space[3] },
  label: { ...typography.bodyStrong, color: lightColors.text },
  input: {
    minHeight: 72,
    borderWidth: 1.5,
    borderColor: lightColors.borderStrong,
    borderRadius: radius.photo,
    padding: space[2],
    backgroundColor: lightColors.bg,
    color: lightColors.text,
    ...typography.body,
    textAlignVertical: 'top',
  },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { minHeight: 44, paddingHorizontal: space[3], borderRadius: radius.button, backgroundColor: lightColors.bg, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: lightColors.accent },
  chipText: { ...typography.bodyStrong, color: lightColors.text },
  chipTextOn: { color: '#FFFFFF' },
  delete: { minHeight: 44, borderRadius: radius.button, borderWidth: 1.5, borderColor: lightColors.danger, alignItems: 'center', justifyContent: 'center' },
  deleteText: { ...typography.bodyStrong, color: lightColors.danger },
  off: { opacity: 0.4 },
});
