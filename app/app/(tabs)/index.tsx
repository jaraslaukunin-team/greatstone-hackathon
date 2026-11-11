import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/ui/Card';
import { PrintStack } from '../../src/ui/PrintStack';
import { Wordmark } from '../../src/ui/Wordmark';
import { lightColors, space, typography } from '../../src/theme/theme';
import { Icon } from '../../src/ui/Icon';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Wordmark />
        <Text style={styles.slogan}>Храните воспоминания красиво</Text>
      </View>

      <Link href="/catalog/books" asChild>
        <Card tone="green" style={styles.hero} accessibilityRole="link">
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Собрать фотокнигу</Text>
            <Text style={styles.heroSub}>Ваши истории на бумаге</Text>
          </View>
          <View style={styles.heroArt}>
            <PrintStack size={104} />
          </View>
        </Card>
      </Link>

      <Link href="/catalog/prints" asChild>
        <Card tone="rose" accessibilityRole="link">
          <Icon name="image" size={28} color={lightColors.text} />
          <Text style={styles.cardTitle}>Напечатать фото</Text>
          <Text style={styles.cardSub}>Любимые кадры — в руках</Text>
        </Card>
      </Link>

      <View style={styles.row}>
        <Link href="/album/create" asChild>
          <Card tone="mint" style={styles.half} accessibilityRole="link">
            <Icon name="heart" size={28} color={lightColors.text} />
            <Text style={styles.cardTitle}>Выпускной альбом</Text>
            <Text style={styles.cardSub}>Соберём вместе</Text>
          </Card>
        </Link>
        <Link href="/ai/consent" asChild>
          <Card tone="lilac" style={styles.half} accessibilityRole="link">
            <Icon name="star" size={28} color={lightColors.text} />
            <Text style={styles.cardTitle}>AI-редактор</Text>
            <Text style={styles.cardSub}>Новый взгляд на фото</Text>
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
