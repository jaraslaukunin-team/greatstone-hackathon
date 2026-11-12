import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/ui/Card';
import { PrintStack } from '../../src/ui/PrintStack';
import { Wordmark } from '../../src/ui/Wordmark';
import { lightColors, space, typography } from '../../src/theme/theme';
import { Icon } from '../../src/ui/Icon';
import { ShowcaseStrip } from '../../src/showcase/ShowcaseStrip';
import { useT } from '../../src/i18n/useT';

export default function HomeScreen() {
  const t = useT();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Wordmark />
        <Text style={styles.slogan}>{t.home.slogan}</Text>
      </View>

      <ShowcaseStrip />

      <Link href="/catalog/books" asChild>
        <Card tone="green" style={styles.hero} accessibilityRole="link">
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>{t.home.heroTitle}</Text>
            <Text style={styles.heroSub}>{t.home.heroSub}</Text>
          </View>
          <View style={styles.heroArt}>
            <PrintStack size={104} />
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
  content: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  header: { marginTop: space[5], marginBottom: space[2], gap: 2 },
  slogan: { ...typography.caption, color: lightColors.textSecondary },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 168,
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
  half: { flex: 1, minHeight: 112 },
});
