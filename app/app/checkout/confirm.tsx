import type { DeliveryMethodId, OrderDTO, QuoteResponse } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { ApiRequestError, NetworkError } from '../../src/api/client';
import { createCheckoutController } from '../../src/checkout/useCheckout';
import { useProjectStore } from '../../src/project/projectStore';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';
import { formatByn } from '@picpac/shared';

export default function ConfirmScreen() {
  const { delivery, payment } = useLocalSearchParams<{ delivery: DeliveryMethodId; payment: string }>();
  const client = useApiClient();
  const { draft, setIdempotencyKey, clear } = useProjectStore();
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const controller = useMemo(() => {
    if (!draft) return null;
    return createCheckoutController({
      client,
      draft,
      setIdempotencyKey,
      delivery: delivery ?? 'belpost',
      pages: Math.max(20, draft.layout.pages.length),
    });
  }, [client, draft, delivery, setIdempotencyKey]);

  useEffect(() => {
    if (!controller) return;
    void controller.quote().then(setQuote).catch(() => setQuote(null));
  }, [controller]);

  async function onPay() {
    if (!controller) return;
    setLoading(true);
    setError(null);
    try {
      const order = await controller.submit();
      clear();
      router.replace({ pathname: '/checkout/result', params: { orderId: order.id, payment } });
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'PRICE_CHANGED') {
        const next = await controller.quote();
        setQuote(next);
        setError('Цена изменилась. Проверьте сумму и нажмите ещё раз.');
      } else if (e instanceof NetworkError) {
        setError('Заказ не отправлен. Проверьте сеть и нажмите «Повторить».');
      } else {
        setError(e instanceof Error ? e.message : 'Ошибка оформления');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!draft) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Корзина пуста</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Подтверждение</Text>
      <Text style={styles.sub}>{draft.project.title}</Text>
      <Text style={styles.price}>{quote ? formatByn(quote.totalKop) : '…'}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={error ? 'Повторить' : 'Оплатить'} disabled={loading} onPress={() => void onPay()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  price: { ...typography.price, color: lightColors.text },
  error: { ...typography.caption, color: lightColors.danger },
});
