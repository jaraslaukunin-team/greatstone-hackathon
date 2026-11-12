import { formatByn } from '@picpac/shared';
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCatalog } from '../../src/catalog/useCatalog';
import { Card } from '../../src/ui/Card';
import { ListSkeleton } from '../../src/ui/Skeleton';
import { FadeIn } from '../../src/ui/FadeIn';
import { staggerDelay } from '../../src/ui/motion';
import { StateBanner } from '../../src/ui/StateBanner';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function BooksScreen() {
  const catalog = useCatalog();

  if (catalog.isLoading) {
    return <ListSkeleton count={3} />;
  }

  if (catalog.isError) {
    return (
      <StateBanner
        title="Не удалось загрузить каталог"
        message="Проверьте соединение и попробуйте снова"
        actionLabel="Повторить"
        onAction={() => void catalog.refetch()}
        tone="danger"
      />
    );
  }

  const books = catalog.data?.products.filter((p) => p.kind === 'photobook') ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <FadeIn>
        <Text style={styles.title}>Фотокниги</Text>
        <Text style={styles.sub}>Выберите, какой будет ваша история</Text>
      </FadeIn>
      {books.map((product, index) => {
        const variant = product.variants[0];
        const formats = product.variants.map((v) => v.format);
        return (
          <Link key={product.id} href={`/catalog/${product.id}`} asChild>
            <Card chevron delay={staggerDelay(index + 1)}>
              <Text style={styles.cardTitle}>{product.title}</Text>
              <Text style={styles.cardSub}>{product.description}</Text>
              {formats.length > 0 ? (
                <View style={styles.chips}>
                  {formats.map((f) => (
                    <View key={f} style={styles.chip}>
                      <Text style={styles.chipText}>{f}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {variant ? (
                <View style={styles.row}>
                  <Text style={styles.price}>от {formatByn(variant.basePriceKop)}</Text>
                  {variant.leadTimeDays > 0 ? (
                    <Text style={styles.lead}>{variant.leadTimeDays} дн.</Text>
                  ) : null}
                </View>
              ) : null}
            </Card>
          </Link>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary, marginBottom: space[2] },
  cardTitle: { ...typography.h2, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1], marginTop: space[2] },
  chip: {
    backgroundColor: lightColors.canvas,
    borderRadius: 999,
    paddingHorizontal: space[3],
    paddingVertical: 3,
  },
  chipText: { ...typography.label, color: lightColors.text },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space[2], marginTop: space[2] },
  price: { ...typography.price, color: lightColors.text },
  lead: { ...typography.caption, color: lightColors.textSecondary },
});
