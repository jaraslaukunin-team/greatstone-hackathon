import { themeById } from '@picpac/shared';
import { Link, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../../src/theme/theme';
import { exampleById, showcaseSourceOf } from '../../src/showcase/examples';

export default function ShowcaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const example = exampleById(id ?? '');
  if (!example) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Пример не найден</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backBtnText}>Назад</Text>
        </Pressable>
      </View>
    );
  }

  const theme = themeById(example.themeId);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.pageBg }]}
      contentContainerStyle={styles.content}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.coverBg }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Назад"
        >
          <Text style={[styles.backBtnText, { color: theme.coverText }]}>‹ Назад</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.coverText }]}>{example.title}</Text>
        <Text style={[styles.subtitle, { color: theme.coverText }]}>
          {example.layout.pages.length} страниц
        </Text>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={[styles.description, { color: lightColors.text }]}>{example.description}</Text>
      </View>

      {/* Horizontal photo strip */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: lightColors.textSecondary }]}>Фотографии</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photoScroll}
          accessibilityLabel="Фотографии примера"
        >
          {example.photos.map((photo) => (
            <View key={photo.id} style={[styles.photoWrap, { borderColor: theme.spine }]}>
              <Image
                source={photo.asset}
                style={styles.photo}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Page count overview */}
      <View style={styles.section}>
        <View style={[styles.statRow, { backgroundColor: lightColors.surface, borderColor: lightColors.border }]}>
          <View style={[styles.statDot, { backgroundColor: theme.accent }]} />
          <Text style={[styles.statLabel, { color: lightColors.textSecondary }]}>Тема</Text>
          <Text style={[styles.statValue, { color: lightColors.text }]}>{example.title}</Text>
        </View>
        <View style={[styles.statRow, { backgroundColor: lightColors.surface, borderColor: lightColors.border }]}>
          <View style={[styles.statDot, { backgroundColor: theme.accent }]} />
          <Text style={[styles.statLabel, { color: lightColors.textSecondary }]}>Страниц</Text>
          <Text style={[styles.statValue, { color: lightColors.text }]}>{example.layout.pages.length}</Text>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.cta}>
        <Link href={showcaseSourceOf(example) as Href} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Сделать такую книгу"
            style={[styles.ctaBtn, { backgroundColor: theme.accent }]}
          >
            <Text style={styles.ctaBtnText}>Сделать такую</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const PHOTO_SIZE = 200;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { paddingBottom: space[7] },
  notFound: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space[4], padding: space[5] },
  notFoundText: { ...typography.h2, color: lightColors.text },

  header: {
    padding: space[5],
    paddingTop: space[6],
    gap: space[1],
    backgroundColor: lightColors.canvas,
  },
  backBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingVertical: space[1],
  },
  backBtnText: { ...typography.bodyStrong, color: lightColors.text },
  title: { ...typography.display, color: lightColors.text },
  subtitle: { ...typography.caption, color: lightColors.textSecondary },

  section: { padding: space[4], gap: space[3] },
  sectionTitle: { ...typography.label, color: lightColors.textSecondary },
  description: { ...typography.body, color: lightColors.text },

  photoScroll: { gap: space[3] },
  photoWrap: {
    borderRadius: radius.photo,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },

  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radius.card,
    borderWidth: 1,
  },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { ...typography.caption, flex: 1 },
  statValue: { ...typography.bodyStrong },

  cta: { padding: space[4], paddingTop: 0 },
  ctaBtn: {
    borderRadius: radius.button,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space[5],
  },
  ctaBtnText: { ...typography.button, color: '#FFFFFF' },
});
