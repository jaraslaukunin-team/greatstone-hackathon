import { formatByn, type QuoteResponse } from '@picpac/shared';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { ensureIdempotencyKey } from '../../src/checkout/idempotency';
import { freeDeliveryHint } from '../../src/checkout/freeDelivery';
import { billablePages } from '../../src/project/billablePages';
import { useProjectStore } from '../../src/project/projectStore';
import { useCatalog } from '../../src/catalog/useCatalog';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { Input } from '../../src/ui/Input';
import { lightColors, space, typography } from '../../src/theme/theme';
import { EmptyState } from '../../src/ui/EmptyState';

export default function CartScreen() {
  const client = useApiClient();
  const catalog = useCatalog();
  const { draft, setIdempotencyKey } = useProjectStore();
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  const delivery = catalog.data?.delivery.find((d) => d.id === 'belpost') ?? null;
  const hint = quote && delivery?.freeFromKop ? freeDeliveryHint(quote.totalKop, delivery.freeFromKop) : null;

  useEffect(() => {
    if (!draft) return;
    ensureIdempotencyKey(draft, setIdempotencyKey);
    void client
      .post<QuoteResponse>('/price-quote', {
        variantId: draft.project.variantId,
        pages: billablePages(draft.layout),
        quantity: 1,
        delivery: 'belpost',
        promoCode: promoApplied ? promoCode.trim() : undefined,
      })
      .then((q) => {
        setQuote(q);
        if (promoApplied && !q.promoApplied) {
          setPromoError('Промокод не применён');
        } else {
          setPromoError(null);
        }
      })
      .catch(() => setQuote(null));
  }, [client, draft, setIdempotencyKey, promoApplied]);

  function applyPromo() {
    if (!promoCode.trim()) return;
    setPromoApplied(true);
  }

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
        {quote?.promoApplied ? (
          <Text style={styles.promoApplied}>Промокод применён · скидка {formatByn(quote.discountKop)}</Text>
        ) : null}
      </Card>
      {hint ? <Text style={styles.freeHint}>{hint}</Text> : null}
      <View style={styles.promoRow}>
        <View style={styles.promoInput}>
          <Input
            value={promoCode}
            onChangeText={(t) => { setPromoCode(t); setPromoApplied(false); setPromoError(null); }}
            placeholder="Промокод"
            autoCapitalize="characters"
          />
        </View>
        <Button title="Применить" variant="secondary" onPress={applyPromo} />
      </View>
      {promoError ? <Text style={styles.promoError}>{promoError}</Text> : null}
      <Text style={styles.hint}>Тестовый режим · деньги не списываются</Text>
      <Button title="Оформить" onPress={() => router.push({ pathname: '/checkout/delivery', params: { promoCode: promoApplied ? promoCode.trim() : '' } })} />
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
  promoApplied: { ...typography.caption, color: lightColors.success, marginTop: 4 },
  freeHint: { ...typography.caption, color: lightColors.success },
  promoRow: { flexDirection: 'row', gap: space[2], alignItems: 'flex-start' },
  promoInput: { flex: 1 },
  promoError: { ...typography.caption, color: lightColors.danger },
  hint: { ...typography.caption, color: lightColors.warning },
});
