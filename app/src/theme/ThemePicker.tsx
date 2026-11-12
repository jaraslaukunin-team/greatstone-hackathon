import { THEMES, type BookTheme, type ThemeId } from '@picpac/shared';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fonts, lightColors, radius, space, typography } from './theme';

type Props = {
  value: ThemeId;
  onChange(id: ThemeId): void;
};

const PAGE = 92;
/** Цвета «фото» на превью: нейтральные, чтобы выделялась именно тема. */
const SAMPLE_PHOTOS = ['#9DB7A8', '#D9B8A3', '#A9BCCB'];

/** Размеры превью страницы: поля и зазор масштабируются от темы, чтобы разницу было видно. */
export function previewMetrics(theme: Pick<BookTheme, 'marginPct' | 'gapPct'>): { margin: number; gap: number } {
  return {
    margin: Math.round(theme.marginPct * PAGE * 1.6) + 3,
    gap: Math.round(theme.gapPct * PAGE * 1.6) + 2,
  };
}

/** Фото-плитка превью в рамке темы: без рамки, тонкая или «полароид» с широким нижним краем. */
function Tile({ theme, color, style }: { theme: BookTheme; color: string; style?: object }) {
  if (theme.frame === 'polaroid') {
    return (
      <View style={[styles.polaroid, { backgroundColor: theme.frameColor }, style]}>
        <View style={[styles.polaroidPhoto, { backgroundColor: color }]} />
      </View>
    );
  }
  return (
    <View
      style={[
        { backgroundColor: color },
        theme.frame === 'thin' ? { borderWidth: 1.5, borderColor: theme.frameColor } : null,
        style,
      ]}
    />
  );
}

/** Мини-страница в теме: лист, поля, зазор, рамка фото и строка подписи цветом темы. */
function PagePreview({ theme }: { theme: BookTheme }) {
  const { margin, gap } = previewMetrics(theme);
  return (
    <View style={[styles.page, { backgroundColor: theme.pageBg, padding: margin, gap }]}>
      <View style={[styles.row, { gap }]}>
        <Tile theme={theme} color={SAMPLE_PHOTOS[0]!} style={styles.fill} />
        <Tile theme={theme} color={SAMPLE_PHOTOS[1]!} style={styles.fill} />
      </View>
      <Tile theme={theme} color={SAMPLE_PHOTOS[2]!} style={styles.fill} />
      <View style={[styles.caption, { backgroundColor: theme.textColor }]} />
    </View>
  );
}

/** Карусель тем: мини-обложка с названием и мини-страница, как будет выглядеть книга внутри. */
export function ThemePicker({ value, onChange }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row2} accessibilityRole="radiogroup">
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
            <View style={[styles.card, { backgroundColor: theme.coverBg }, selected && styles.cardSelected]}>
              <Text style={[styles.coverTitle, { color: theme.titleColor, fontFamily: fonts[theme.titleFont] }]} numberOfLines={1}>
                picPac
              </Text>
              <PagePreview theme={theme} />
              <View style={[styles.spine, { backgroundColor: theme.spine }]} />
            </View>
            <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
              {theme.title}
            </Text>
            {selected ? <View style={[styles.dot, { backgroundColor: theme.accent }]} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row2: { gap: space[3], paddingVertical: space[1] },
  item: { width: PAGE + 28, minHeight: 44, gap: space[1], alignItems: 'center' },
  card: {
    width: PAGE + 20,
    borderRadius: radius.photo * 3,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    gap: 6,
    overflow: 'hidden',
  },
  cardSelected: { borderColor: lightColors.accent },
  coverTitle: { ...typography.label, textAlign: 'center' },
  page: { width: PAGE, height: PAGE, borderRadius: 2 },
  row: { flexDirection: 'row', flex: 1.2 },
  fill: { flex: 1 },
  caption: { height: 3, width: '46%', alignSelf: 'center', borderRadius: 2, opacity: 0.85 },
  polaroid: { padding: 3, paddingBottom: 8 },
  polaroidPhoto: { flex: 1 },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  name: { ...typography.caption, color: lightColors.textSecondary, textAlign: 'center' },
  nameSelected: { color: lightColors.text, fontFamily: fonts.demi },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
