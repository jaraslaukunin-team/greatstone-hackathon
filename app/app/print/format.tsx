import { formatByn } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useCatalog } from '../../src/catalog/useCatalog';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function PrintFormatScreen() {
  // photoId/sourceProjectId приходят из AI-редактора: тогда формат выбирается для уже готового фото.
  const { productId, photoId, sourceProjectId } = useLocalSearchParams<{
    productId?: string;
    photoId?: string;
    sourceProjectId?: string;
  }>();
  const catalog = useCatalog();
  if (catalog.isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={lightColors.accent} />;
  const prints = (catalog.data?.products ?? []).filter((p) => p.kind === 'prints');
  const products = productId ? prints.filter((p) => p.id === productId) : prints;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Выберите формат</Text>
      <Text style={styles.sub}>
        Фото печатается целиком, без растяжения. Обрезать под формат можно будет на следующем шаге.
      </Text>
      {products.map((product) => (
        <Card key={product.id}>
          <Text style={styles.product}>{product.title}</Text>
          {product.variants.map((variant) => (
            <Pressable
              key={variant.id}
              accessibilityRole="button"
              style={styles.variant}
              onPress={() =>
                router.push({
                  pathname: '/print/frames',
                  params: { variantId: variant.id, photoId: photoId ?? '', sourceProjectId: sourceProjectId ?? '' },
                })
              }
            >
              <Text style={styles.cardTitle}>{variant.format}</Text>
              <Text style={styles.price}>{formatByn(variant.basePriceKop)} за отпечаток</Text>
            </Pressable>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  product: { ...typography.h2, color: lightColors.text, marginBottom: space[2] },
  variant: {
    paddingVertical: space[3],
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    minHeight: 44,
  },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  price: { ...typography.caption, color: lightColors.textSecondary, marginTop: 2 },
});
