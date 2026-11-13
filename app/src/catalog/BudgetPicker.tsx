import { formatByn, type ProductDTO } from '@picpac/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tr } from '../i18n/runtimeTranslate';
import { useApiClient } from '../api/hooks';
import { findBudgetOptions, parseBudgetKop } from '../catalog/budget';
import { lightColors, space, typography } from '../theme/theme';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';
import { StateBanner } from '../ui/StateBanner';

export function BudgetPicker({ products }: { products: ProductDTO[] }) {
  const client = useApiClient();
  const [amount, setAmount] = useState('');
  const budgetKop = parseBudgetKop(amount);
  const [settled, setSettled] = useState<number | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(budgetKop), 300);
    return () => clearTimeout(timer);
  }, [budgetKop]);
  const active = budgetKop !== null && budgetKop === settled;
  const search = useQuery({
    queryKey: ['budget-quotes', settled, products.flatMap((product) => product.variants.map((variant) => variant.id))],
    queryFn: () => findBudgetOptions(client, products, settled!),
    enabled: active,
    staleTime: 30_000,
    retry: false,
  });

  return (
    <View style={styles.panel}>
      <Text style={styles.optionTitle}>Подбери под бюджет</Text>
      <Text style={styles.body}>Укажите бюджет на одну фотокнигу без доставки.</Text>
      <Input
        accessibilityLabel="Бюджет в BYN"
        placeholder="Бюджет, BYN"
        keyboardType="decimal-pad"
        value={amount}
        maxLength={16}
        onChangeText={setAmount}
      />
      {budgetKop !== null && (!active || search.isFetching) ? (
        <Text accessibilityLiveRegion="polite" style={styles.body}>Проверяем цены…</Text>
      ) : null}
      {active && search.isError ? (
        <StateBanner
          title="Не удалось проверить цены"
          message="Проверьте соединение и попробуйте снова"
          actionLabel="Повторить"
          onAction={() => void search.refetch()}
          tone="danger"
        />
      ) : null}
      {active && search.data?.length === 0 ? (
        <StateBanner title="Фотокниг в этом бюджете нет" message="Попробуйте увеличить сумму." />
      ) : null}
      {active && search.data?.map((option) => (
        <Card key={option.variantId} style={styles.option}>
          <Text style={styles.optionTitle}>{option.productTitle}</Text>
          <Text style={styles.body}>{option.format}</Text>
          <Text style={styles.body}>{tr('Страниц:')} {option.pages}</Text>
          <Text style={styles.price}>{formatByn(option.priceKop)}</Text>
          <Button
            title="Выбрать"
            variant="secondary"
            onPress={() =>
              router.push({
                pathname: '/catalog/[productId]',
                params: { productId: option.productId, variantId: option.variantId, pages: String(option.pages) },
              })
            }
          />
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: space[2], padding: space[3], borderWidth: 1, borderColor: lightColors.border, borderRadius: 12, backgroundColor: lightColors.canvas },
  body: { ...typography.body, color: lightColors.textSecondary },
  option: { gap: space[2] },
  optionTitle: { ...typography.h2, color: lightColors.text },
  price: { ...typography.price, color: lightColors.text },
});
