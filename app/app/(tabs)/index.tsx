import { Link, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCatalog } from '../../src/catalog/useCatalog';
import { projectKind, projectKindLabel } from '../../src/project/projectKind';
import { useProjectStore } from '../../src/project/projectStore';
import { Card } from '../../src/ui/Card';
import { PrintStack } from '../../src/ui/PrintStack';
import { lightColors, space, typography } from '../../src/theme/theme';
import { Icon } from '../../src/ui/Icon';
import { StoriesStrip } from '../../src/stories/StoriesStrip';
import { useT } from '../../src/i18n/useT';

export default function HomeScreen() {
  const t = useT();
  const draft = useProjectStore((s) => s.draft);
  const catalog = useCatalog();
  const continueKind = draft
    ? projectKindLabel(projectKind(draft.project, catalog.data))
    : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.slogan}>{t.home.slogan}</Text>

      {draft ? (
        <Pressable
          onPress={() => router.push(`/project/${draft.project.id}/overview`)}
          accessibilityRole="link"
          accessibilityLabel="Продолжить проект"
        >
          <Card tone="sky" chevron>
            <Text style={styles.continueEyebrow}>Продолжить проект</Text>
            <Text style={styles.cardTitle}>{draft.project.title}</Text>
            <Text style={styles.cardSub}>
              {continueKind}
              {draft.project.status === 'draft' ? ' · Черновик' : ''}
            </Text>
          </Card>
        </Pressable>
      ) : null}

      <StoriesStrip />

      <Link href="/catalog/books" asChild>
        <Card tone="green" style={styles.hero} accessibilityRole="link">
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{t.home.heroTitle}</Text>
            <Text style={styles.heroSub}>{t.home.heroSub}</Text>
          </View>
          <View style={styles.heroArt}>
            <PrintStack size={120} />
          </View>
        </Card>
      </Link>

      <Link href="/catalog/prints" asChild>
        <Card tone="rose" accessibilityRole="link">
          <Icon name="image" size={28} color={lightColors.text} />
          <Text style={styles.cardTitle}>{t.home.printsTitle}</Text>
          <Text style={styles.cardSub}>{t.home.printsSub}</Text>
        </Card>
      </Link>

      <Link href="/album/event-create" asChild>
        <Card tone="sky" accessibilityRole="link">
          <Icon name="image" size={28} color={lightColors.text} />
          <Text style={styles.cardTitle}>Общий альбом</Text>
          <Text style={styles.cardSub}>Пул фото по ссылке — у каждого своя книга</Text>
        </Card>
      </Link>

      <View style={styles.row}>
        <Link href="/album/create" asChild>
          <Card tone="mint" style={styles.half} accessibilityRole="link">
            <Icon name="heart" size={28} color={lightColors.text} />
            <Text style={styles.cardTitle}>{t.home.albumTitle}</Text>
            <Text style={styles.cardSub}>{t.home.albumSub}</Text>
          </Card>
        </Link>
        <Link href="/ai/consent" asChild>
          <Card tone="lilac" style={styles.half} accessibilityRole="link">
            <Icon name="star" size={28} color={lightColors.text} />
            <Text style={styles.cardTitle}>{t.home.aiTitle}</Text>
            <Text style={styles.cardSub}>{t.home.aiSub}</Text>
          </Card>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: {
    flexGrow: 1,
    padding: space[4],
    gap: space[4],
    paddingTop: space[3],
    paddingBottom: space[7],
  },
  slogan: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 26,
    color: lightColors.textSecondary,
    letterSpacing: 0.8,
  },
  continueEyebrow: { ...typography.label, color: lightColors.textSecondary },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 200,
    padding: space[5],
    overflow: 'hidden',
  },
  heroText: { flex: 1, gap: space[1], paddingRight: space[2] },
  heroTitle: { ...typography.h1, color: '#FFFFFF' },
  heroSub: { ...typography.body, color: lightColors.fillMint },
  heroArt: { marginRight: -space[2] },
  cardTitle: { ...typography.h3, color: lightColors.text, marginTop: space[2] },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginTop: 2 },
  row: { flexDirection: 'row', gap: space[3] },
  half: { flex: 1, minHeight: 132 },
});
