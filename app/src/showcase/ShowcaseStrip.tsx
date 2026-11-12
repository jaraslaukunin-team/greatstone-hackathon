import { themeById } from '@picpac/shared';
import { Link } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';
import { EXAMPLES } from './examples';

/** Horizontal strip of showcase examples shown on the home screen. */
export function ShowcaseStrip() {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Примеры оформления</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        accessibilityLabel="Примеры оформления фотокниг"
      >
        {EXAMPLES.map((ex) => {
          const theme = themeById(ex.themeId);
          return (
            <Link key={ex.id} href={`/showcase/${ex.id}`} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Пример «${ex.title}»: ${ex.layout.pages.length} страниц`}
                style={styles.card}
              >
                {/* Photo strip: first 3 photos side by side */}
                <View style={[styles.photoRow, { backgroundColor: theme.coverBg }]}>
                  {ex.photos.slice(0, 3).map((photo) => (
                    <Image
                      key={photo.id}
                      source={photo.asset}
                      style={styles.thumb}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ))}
                </View>

                {/* Card footer */}
                <View style={[styles.footer, { backgroundColor: theme.coverBg }]}>
                  <View style={[styles.accentDot, { backgroundColor: theme.accent }]} />
                  <View style={styles.footerText}>
                    <Text style={[styles.cardTitle, { color: theme.coverText }]} numberOfLines={1}>
                      {ex.title}
                    </Text>
                    <Text style={[styles.cardSub, { color: theme.coverText }]} numberOfLines={1}>
                      {ex.layout.pages.length} стр.
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>
    </View>
  );
}

const CARD_W = 160;
const THUMB_W = CARD_W / 3;
const THUMB_H = 80;

const styles = StyleSheet.create({
  section: { gap: space[2] },
  heading: { ...typography.h3, color: lightColors.text, paddingHorizontal: space[4] },
  scroll: { paddingHorizontal: space[4], gap: space[3], paddingBottom: 4 },
  card: {
    width: CARD_W,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  photoRow: {
    flexDirection: 'row',
    height: THUMB_H,
  },
  thumb: {
    width: THUMB_W,
    height: THUMB_H,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[2],
    minHeight: 44,
  },
  accentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  footerText: { flex: 1 },
  cardTitle: { ...typography.label },
  cardSub: { ...typography.caption, opacity: 0.7 },
});
