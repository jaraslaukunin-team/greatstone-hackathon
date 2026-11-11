import { formatByn, type QuoteResponse } from '@picpac/shared';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { ensureIdempotencyKey } from '../../src/checkout/idempotency';
import { billablePages } from '../../src/project/billablePages';
import { useProjectStore } from '../../src/project/projectStore';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';
import { EmptyState } from '../../src/ui/EmptyState';

export default function CartScreen() {
  const client = useApiClient();
  const { draft, setIdempotencyKey } = useProjectStore();
  const [quote, setQuote] = useState<QuoteResponse | null>(null);

  useEffect(() => {
    if (!draft) return;
    ensureIdempotencyKey(draft, setIdempotencyKey);
    void client
      .post<QuoteResponse>('/price-quote', {
        variantId: draft.project.variantId,
        pages: billablePages(draft.layout),
        quantity: 1,
        delivery: 'belpost',
      })
      .then(setQuote)
      .catch(() => setQuote(null));
  }, [client, draft, setIdempotencyKey]);

  if (!draft) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Корзина</Text>
        <EmptyState icon="cart" title="В корзине пусто" message="Добавьте проект из каталога">
          <Link href="/catalog/books" asChild>
            <Button title="К каталогу" />
          </Link>
        </EmptyState>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Корзина</Text>
      <Card>
        <Text style={styles.cardTitle}>{draft.project.title}</Text>
        <Text style={styles.cardSub}>{billablePages(draft.layout)} {draft.layout.pages.some((p) => p.copies) ? 'отпечатков' : 'страниц'}</Text>
        <Text style={styles.price}>{quote ? formatByn(quote.totalKop) : '…'}</Text>
      </Card>
      <Text style={styles.hint}>Тестовый режим · деньги не списываются</Text>
      <Button title="Оформить" onPress={() => router.push('/checkout/delivery')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3], paddingTop: space[7] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginTop: 4 },
  price: { ...typography.price, color: lightColors.text, marginTop: space[2] },
  hint: { ...typography.caption, color: lightColors.warning },
});
