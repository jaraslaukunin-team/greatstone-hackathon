import { DEFAULT_THEME_ID, formatByn, themeById, type ThemeId } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCatalog, useVariantPrice } from '../../src/catalog/useCatalog';
import { useApiClient } from '../../src/api/hooks';
import { useThemeChoice } from '../../src/project/themeChoiceStore';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { ThemePicker } from '../../src/theme/ThemePicker';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function ProductScreen() {
  const { productId, theme: themeParam } = useLocalSearchParams<{ productId: string; theme?: string }>();
  // Тема может прийти из примера на главной («Сделать такую»); неизвестная заменяется темой по умолчанию.
  const [themeId, setThemeId] = useState<ThemeId>(themeById(themeParam ?? DEFAULT_THEME_ID).id);
  const catalog = useCatalog();
  const client = useApiClient();
  const product = catalog.data?.products.find((p) => p.id === productId);
  const variant = product?.variants[0];
  const [pages, setPages] = useState(variant?.pagesMin ?? 20);
  const quote = useVariantPrice(variant?.id ?? null, pages);
  const title = useMemo(() => `Книга ${product?.title ?? ''}`.trim(), [product?.title]);

  if (catalog.isLoading || !product || !variant) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={lightColors.accent} />;
  }

  async function startProject() {
    const project = await client.post<{ id: string }>('/projects', {
      variantId: variant!.id,
      title,
    });
    useThemeChoice.getState().set(project.id, themeId);
    router.push(`/project/${project.id}/photos`);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{product.title}</Text>
      <Text style={styles.sub}>{product.description}</Text>
      <Text style={styles.label}>Оформление</Text>
      <ThemePicker value={themeId} onChange={setThemeId} />
      <Card>
        <Text style={styles.label}>Формат {variant.format}</Text>
        <Text style={styles.label}>
          Страниц: {pages} (мин {variant.pagesMin})
        </Text>
        <View style={styles.row}>
          <Button title="−" variant="secondary" onPress={() => setPages((p) => Math.max(variant.pagesMin, p - 2))} />
          <Button title="+" variant="secondary" onPress={() => setPages((p) => Math.min(variant.pagesMax, p + 2))} />
        </View>
        <Text style={styles.price}>
          {quote.data ? formatByn(quote.data.totalKop) : '…'}
          {quote.stale ? ' · устарело' : ''}
        </Text>
      </Card>
      <Button title="Собрать книгу" onPress={() => void startProject()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text, marginTop: space[5] },
  sub: { ...typography.body, color: lightColors.textSecondary },
  label: { ...typography.body, color: lightColors.text },
  row: { flexDirection: 'row', gap: space[2], marginTop: space[3] },
  price: { ...typography.price, color: lightColors.text, marginTop: space[3] },
});
