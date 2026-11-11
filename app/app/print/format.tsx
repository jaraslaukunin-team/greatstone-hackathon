import { formatByn } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useCatalog } from '../../src/catalog/useCatalog';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function PrintFormatScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const catalog = useCatalog();
  if (catalog.isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={lightColors.accent} />;
  const product = catalog.data?.products.find((p) => p.id === productId);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Выберите формат</Text>
      <Text style={styles.sub}>{product?.description ?? 'Глянцевая бумага, печать без полей'}</Text>
      {(product?.variants ?? []).map((variant) => (
        <Pressable
          key={variant.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/print/frames', params: { variantId: variant.id } })}
        >
          <Card chevron>
            <Text style={styles.cardTitle}>{variant.format}</Text>
            <Text style={styles.price}>{formatByn(variant.basePriceKop)} за отпечаток</Text>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  cardTitle: { ...typography.h2, color: lightColors.text },
  price: { ...typography.price, color: lightColors.text, marginTop: space[2] },
});
