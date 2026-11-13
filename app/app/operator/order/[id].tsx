import type { OrderDTO, OrderStatus } from '@picpac/shared';
import { statusLabel } from '../../../src/orders/statusLabel';
import { orderStatusTone } from '../../../src/orders/statusTone';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { DownloadBookPdf } from '../../../src/project/DownloadBookPdf';
import { Button } from '../../../src/ui/Button';
import { Card } from '../../../src/ui/Card';
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
    void Promise.resolve().then(reload).catch(() => setOrder(null));
  }, [reload]);

  async function advance() {
    if (!order) return;
    const status = NEXT[order.status];
    if (!status) return;
    setError(null);
    try {
      const updated = await client.post<OrderDTO>(`/operator/orders/${id}/status`, { status });
      setOrder(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сменить статус');
    }
  }

  const tone = orderStatusTone(order?.status);
  const next = order ? NEXT[order.status] : undefined;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{order?.number ?? 'Заказ'}</Text>
      <Card style={{ backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }}>
        <Text style={styles.sub}>Статус</Text>
        <Text style={[styles.status, { color: tone.statusColor }]}>{statusLabel(order?.status)}</Text>
      </Card>
      {order?.projectId ? <DownloadBookPdf projectId={order.projectId} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {next ? (
        <Button title={`Следующий статус: ${statusLabel(next)}`} onPress={() => void advance()} />
      ) : order ? (
        <Text style={styles.sub}>Это конечный статус, дальше менять нельзя.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  status: { ...typography.h2, marginTop: 2 },
  error: { ...typography.caption, color: lightColors.danger },
});
