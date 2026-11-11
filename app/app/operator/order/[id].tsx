import type { OrderDTO, OrderStatus } from '@picpac/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { Button } from '../../../src/ui/Button';
import { lightColors, space, typography } from '../../../src/theme/theme';

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  accepted: 'moderation',
  moderation: 'production',
  production: 'ready_for_delivery',
  ready_for_delivery: 'completed',
};

export default function OperatorOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const next = await client.get<OrderDTO>(`/orders/${id}`);
    setOrder(next);
  }, [client, id]);

  useEffect(() => {
    void reload().catch(() => setOrder(null));
  }, [reload]);

  async function advance() {
    if (!order) return;
    const status = NEXT[order.status];
    if (!status) return;
    setError(null);
    try {
      const updated = await client.patch<OrderDTO>(`/operator/orders/${id}/status`, { status });
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сменить статус');
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{order?.number ?? 'Заказ'}</Text>
      <Text style={styles.sub}>Статус: {order?.status ?? '…'}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Следующий статус" onPress={() => void advance()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  error: { ...typography.caption, color: lightColors.danger },
});
