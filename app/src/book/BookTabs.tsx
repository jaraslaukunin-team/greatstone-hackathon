import { Pressable, StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, typography } from '../theme/theme';

export type BookTab = 'cover' | 'spread' | 'pages';

const TABS: { id: BookTab; label: string }[] = [
  { id: 'cover', label: 'Обложка' },
  { id: 'spread', label: 'Разворот' },
  { id: 'pages', label: 'Страницы' },
];

type Props = { value: BookTab; onChange(tab: BookTab): void };

/** Три вкладки книги в одной капсуле. */
export function BookTabs({ value, onChange }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = t.id === value;
        return (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.id)}
            style={[styles.tab, on && styles.tabOn]}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: lightColors.surface, borderRadius: radius.button, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 44, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: lightColors.bg },
  label: { ...typography.bodyStrong, color: lightColors.textSecondary },
  labelOn: { color: lightColors.accent },
});
