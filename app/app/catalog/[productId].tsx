import { DEFAULT_THEME_ID, formatByn, themeById, type ThemeId } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCatalog, useVariantPrice } from '../../src/catalog/useCatalog';
import { goodsPriceKop } from '../../src/checkout/goodsPrice';
import { useApiClient } from '../../src/api/hooks';
import { useThemeChoice, useThemeChoiceStore } from '../../src/project/themeChoiceStore';
import { ThemePicker } from '../../src/theme/ThemePicker';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { ListSkeleton } from '../../src/ui/Skeleton';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function ProductScreen() {
  const { productId, theme: themeParam } = useLocalSearchParams<{ productId: string; theme?: string }>();
  // Тема может прийти из примера на главной («Сделать такую»); неизвестная заменяется темой по умолчанию.
  const [themeId, setThemeId] = useState<ThemeId>(themeById(themeParam ?? DEFAULT_THEME_ID).id);
  const catalog = useCatalog();
  const client = useApiClient();
  const { mode, setMode } = useThemeChoiceStore();
  const product = catalog.data?.products.find((p) => p.id === productId);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const variant = selectedVariantId
    ? (product?.variants.find((v) => v.id === selectedVariantId) ?? product?.variants[0])
    : product?.variants[0];
  const [pages, setPages] = useState<number | null>(null);
  const effectivePages = pages ?? variant?.pagesMin ?? 20;
  const quote = useVariantPrice(variant?.id ?? null, effectivePages);
  const title = useMemo(() => `Книга ${product?.title ?? ''}`.trim(), [product?.title]);

  if (catalog.isLoading || !product || !variant) {
    return <ListSkeleton count={2} />;
  }

  // When variant changes, reset pages to its min
  function selectVariant(id: string) {
    const v = product!.variants.find((v) => v.id === id);
    setSelectedVariantId(id);
    setPages(v?.pagesMin ?? null);
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

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Оформление</Text>
        <ThemePicker value={themeId} onChange={setThemeId} />
      </View>

      {product.variants.length > 1 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Формат</Text>
          <View style={styles.chips}>
            {product.variants.map((v) => {
              const active = v.id === (selectedVariantId ?? product.variants[0]!.id);
              return (
                <Pressable
                  key={v.id}
                  accessibilityRole="button"
                  onPress={() => selectVariant(v.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{v.format}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : (
        <Card>
          <Text style={styles.label}>Формат {variant.format}</Text>
        </Card>
      )}

      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>Страниц: {effectivePages}</Text>
          <Text style={styles.hint}>мин {variant.pagesMin} · макс {variant.pagesMax}</Text>
        </View>
        <View style={styles.counter}>
          <Button
            title="−"
            variant="secondary"
            onPress={() => setPages((p) => Math.max(variant!.pagesMin, (p ?? effectivePages) - 2))}
          />
          <Button
            title="+"
            variant="secondary"
            onPress={() => setPages((p) => Math.min(variant!.pagesMax, (p ?? effectivePages) + 2))}
          />
        </View>
        {variant.leadTimeDays > 0 ? (
          <Text style={styles.lead}>Срок: {variant.leadTimeDays} рабочих дней</Text>
        ) : null}
        <Text style={styles.price}>
          {quote.data ? formatByn(goodsPriceKop(quote.data)) : '…'}
          {quote.stale ? ' · устарело' : ''}
        </Text>
      </Card>

      <Card>
        <Text style={styles.sectionLabel}>Раскладка фото</Text>
        <View style={styles.modeRow}>
          <Pressable
            accessibilityRole="button"
            style={[styles.modeBtn, mode === 'auto' && styles.modeBtnActive]}
            onPress={() => setMode('auto')}
          >
            <Text style={[styles.modeBtnText, mode === 'auto' && styles.modeBtnTextActive]}>Автоматически</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={[styles.modeBtn, mode === 'manual' && styles.modeBtnActive]}
            onPress={() => setMode('manual')}
          >
            <Text style={[styles.modeBtnText, mode === 'manual' && styles.modeBtnTextActive]}>Сам</Text>
          </Pressable>
        </View>
        <Text style={styles.modeHint}>
          {mode === 'auto'
            ? 'Мы разложим фото по страницам автоматически'
            : 'Вы сами выбираете расположение на каждой странице'}
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
  hint: { ...typography.caption, color: lightColors.textSecondary },
  lead: { ...typography.caption, color: lightColors.textSecondary, marginTop: space[2] },
  section: { gap: space[2] },
  sectionLabel: { ...typography.label, color: lightColors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 999,
    paddingHorizontal: space[3],
    paddingVertical: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: lightColors.action,
    borderColor: lightColors.action,
  },
  chipText: { ...typography.label, color: lightColors.text },
  chipTextActive: { color: lightColors.textOnAccent },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space[2], marginBottom: space[2] },
  counter: { flexDirection: 'row', gap: space[2] },
  price: { ...typography.price, color: lightColors.text, marginTop: space[3] },
  modeRow: { flexDirection: 'row', gap: space[2], marginTop: space[2] },
  modeBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: lightColors.action,
    borderColor: lightColors.action,
  },
  modeBtnText: { ...typography.label, color: lightColors.text },
  modeBtnTextActive: { color: lightColors.textOnAccent },
  modeHint: { ...typography.caption, color: lightColors.textSecondary, marginTop: space[2] },
});
