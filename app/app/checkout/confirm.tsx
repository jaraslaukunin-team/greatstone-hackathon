import type { DeliveryMethodId, OrderDTO, PaymentMethod, QuoteResponse } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { ApiRequestError, NetworkError } from '../../src/api/client';
import { useAddressStore } from '../../src/checkout/addressStore';
import { createCheckoutController } from '../../src/checkout/useCheckout';
import { billablePages } from '../../src/project/billablePages';
import { useProjectStore } from '../../src/project/projectStore';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';
import { formatByn } from '@picpac/shared';

export default function ConfirmScreen() {
  const { delivery, payment, promoCode } = useLocalSearchParams<{
    delivery: DeliveryMethodId;
    payment: PaymentMethod;
    promoCode?: string;
  }>();
  const client = useApiClient();
  const { draft, setIdempotencyKey, clear } = useProjectStore();
  const address = useAddressStore((s) => s.address);
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
      payment: payment ?? 'card',
      promoCode: promoCode?.trim() || undefined,
      pages: billablePages(draft.layout),
      address: address ?? undefined,
    });
  }, [client, draft, delivery, payment, promoCode, address, setIdempotencyKey]);

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
      useAddressStore.getState().setAddress(null);
      router.replace({ pathname: '/checkout/result', params: { orderId: order.id, payment: payment ?? 'card' } });
    } catch (e) {
      if (e instanceof ApiRequestError && e.code === 'PRICE_CHANGED') {
        const next = await controller.quote();
        setQuote(next);
        setError('Цена изменилась. Проверьте сумму и нажмите ещё раз.');
      } else if (e instanceof ApiRequestError && e.code === 'PAYMENT_FAILED') {
        router.replace({ pathname: '/checkout/payment-error', params: { delivery: delivery ?? 'belpost' } });
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
      {quote?.promoApplied ? (
        <Text style={styles.promo}>Промокод применён · скидка {formatByn(quote.discountKop)}</Text>
      ) : null}
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
  promo: { ...typography.caption, color: lightColors.success },
  error: { ...typography.caption, color: lightColors.danger },
});
