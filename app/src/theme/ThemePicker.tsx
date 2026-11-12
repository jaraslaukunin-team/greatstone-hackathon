import { THEMES, type ThemeId } from '@picpac/shared';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fonts, lightColors, radius, space, typography } from './theme';

type Props = {
  value: ThemeId;
  onChange(id: ThemeId): void;
};

/** Карусель тем оформления: мини-обложка в цветах темы и её название. */
export function ThemePicker({ value, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="radiogroup">
      {THEMES.map((theme) => {
        const selected = theme.id === value;
        return (
          <Pressable
            key={theme.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Оформление «${theme.title}»`}
            onPress={() => onChange(theme.id)}
            style={styles.item}
          >
            <View style={[styles.cover, { backgroundColor: theme.coverBg }, selected && styles.coverSelected]}>
              <View style={[styles.sheet, { backgroundColor: theme.pageBg, borderColor: theme.frameColor }]} />
              <Text style={[styles.coverTitle, { color: theme.titleColor, fontFamily: fonts[theme.titleFont] }]} numberOfLines={1}>
                picPac
              </Text>
            </View>
            <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
              {theme.title}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space[3], paddingVertical: space[1] },
  item: { width: 96, minHeight: 44, gap: space[1] },
  cover: {
    height: 112,
    borderRadius: radius.photo * 2,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: space[2],
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  coverSelected: { borderColor: lightColors.accent },
  sheet: { flex: 1, borderWidth: 1, borderRadius: radius.photo },
  coverTitle: { ...typography.label, marginTop: space[1] },
  name: { ...typography.caption, color: lightColors.textSecondary, textAlign: 'center' },
  nameSelected: { color: lightColors.text, fontFamily: fonts.demi },
});
