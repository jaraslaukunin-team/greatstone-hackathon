import { formatByn } from '@picpac/shared';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { findBudgetOptions, parseBudgetKop } from '../../src/catalog/budget';
import { useCatalog } from '../../src/catalog/useCatalog';
import { lightColors, space, typography } from '../../src/theme/theme';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { Input } from '../../src/ui/Input';
import { ListSkeleton } from '../../src/ui/Skeleton';
import { StateBanner } from '../../src/ui/StateBanner';

export default function BudgetScreen() {
  const catalog = useCatalog();
  const client = useApiClient();
  const [amount, setAmount] = useState('');
  const budgetKop = parseBudgetKop(amount);
  const search = useMutation({
    mutationFn: (limitKop: number) => findBudgetOptions(client, catalog.data?.products ?? [], limitKop),
  });

  if (catalog.isPending) return <ListSkeleton count={2} />;
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

  function submit() {
    if (budgetKop !== null && !search.isPending) search.mutate(budgetKop);
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Подбери под бюджет</Text>
      <Text style={styles.body}>Укажите бюджет на одну фотокнигу без доставки.</Text>
      <Input
        accessibilityLabel="Бюджет в BYN"
        placeholder="Например, 100"
        keyboardType="decimal-pad"
        value={amount}
        maxLength={16}
        editable={!search.isPending}
        onChangeText={(value) => {
          search.reset();
          setAmount(value);
        }}
        onSubmitEditing={submit}
      />
      <Button
        title={search.isPending ? 'Проверяем цены…' : 'Подобрать фотокнигу'}
        onPress={submit}
        disabled={budgetKop === null || search.isPending}
      />
      {search.isError ? (
        <StateBanner
          title="Не удалось проверить цены"
          message="Проверьте соединение и попробуйте снова"
          tone="danger"
        />
      ) : null}
      {search.data?.length === 0 ? (
        <StateBanner title="Фотокниг в этом бюджете нет" message="Попробуйте увеличить сумму." />
      ) : null}
      {search.data?.map((option) => (
        <Card key={option.variantId} style={styles.option}>
          <Text style={styles.optionTitle}>{option.productTitle}</Text>
          <Text style={styles.body}>{option.format}</Text>
          <Text style={styles.body}>Страниц: {option.pages}</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  body: { ...typography.body, color: lightColors.textSecondary },
  option: { gap: space[2] },
  optionTitle: { ...typography.h2, color: lightColors.text },
  price: { ...typography.price, color: lightColors.text },
});
