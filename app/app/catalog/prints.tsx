import { formatByn } from '@picpac/shared';
import { Link } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { useCatalog } from '../../src/catalog/useCatalog';
import { Card } from '../../src/ui/Card';
import { StateBanner } from '../../src/ui/StateBanner';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function PrintsScreen() {
  const catalog = useCatalog();
  if (catalog.isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={lightColors.accent} />;
  if (catalog.isError) {
    return (
      <StateBanner
        title="Не удалось загрузить каталог"
        actionLabel="Повторить"
        onAction={() => void catalog.refetch()}
        tone="danger"
      />
    );
  }
  const prints = catalog.data?.products.filter((p) => p.kind === 'prints') ?? [];
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Печать фото</Text>
      {prints.map((product) => {
        const variant = product.variants[0];
        return (
          <Link key={product.id} href={{ pathname: '/print/format', params: { productId: product.id } }} asChild>
            <Card chevron>
              <Text style={styles.cardTitle}>{product.title}</Text>
              {variant ? <Text style={styles.price}>от {formatByn(variant.basePriceKop)}</Text> : null}
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
  cardTitle: { ...typography.h2, color: lightColors.text },
  price: { ...typography.price, color: lightColors.text, marginTop: space[2] },
});
