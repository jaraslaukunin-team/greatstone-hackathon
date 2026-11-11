import { formatByn } from '@picpac/shared';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.logo}>picPac</Text>
      <Text style={styles.slogan}>Храните воспоминания красиво</Text>
      <Text style={styles.priceSample}>от {formatByn(0)}</Text>

      <Link href="/catalog/books" asChild>
        <Card style={styles.hero}>
          <Text style={styles.heroTitle}>Собрать фотокнигу</Text>
          <Text style={styles.heroSub}>Ваши истории на бумаге</Text>
        </Card>
      </Link>

      <Link href="/catalog/prints" asChild>
        <Card>
          <Text style={styles.cardTitle}>Напечатать фото</Text>
          <Text style={styles.cardSub}>Любимые кадры — в руках</Text>
        </Card>
      </Link>

      <View style={styles.row}>
        <Link href="/album/create" asChild>
          <Card style={styles.half}>
            <Text style={styles.cardTitle}>Выпускной альбом</Text>
            <Text style={styles.cardSub}>Соберём вместе</Text>
          </Card>
        </Link>
        <Link href="/ai/consent" asChild>
          <Card style={styles.half}>
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
  logo: { ...typography.h1, color: lightColors.accent, marginTop: space[5] },
  slogan: { ...typography.caption, color: lightColors.textMuted },
  priceSample: { ...typography.caption, color: lightColors.textMuted },
  hero: { backgroundColor: lightColors.accent, borderColor: lightColors.accent },
  heroTitle: { ...typography.h2, color: '#FFFFFF' },
  heroSub: { ...typography.caption, color: '#FFFFFF', marginTop: 4 },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textMuted, marginTop: 4 },
  row: { flexDirection: 'row', gap: space[3] },
  half: { flex: 1 },
});
