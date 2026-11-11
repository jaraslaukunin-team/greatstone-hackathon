import { formatByn } from '@picpac/shared';
import { statusLabel } from '../../src/orders/statusLabel';
import { Link, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useOrderPolling } from '../../src/orders/useOrderPolling';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const { order, error } = useOrderPolling({ client, orderId: id ?? null, intervalMs: 5000 });

  async function cancel() {
    await client.post(`/orders/${id}/cancel`);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{order?.number ?? 'Заказ'}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Card>
        <Text style={styles.cardTitle}>Статус: {statusLabel(order?.status)}</Text>
        <Text style={styles.cardSub}>{order ? formatByn(order.totalKop) : ''}</Text>
      </Card>
      {(order?.history ?? []).map((item, index) => (
        <Text key={`${item.status}-${index}`} style={styles.history}>
          {statusLabel(item.status)} · {new Date(item.at).toLocaleString('ru-RU')}
        </Text>
      ))}
      {order?.status === 'accepted' ? (
        <Button title="Отменить заказ" variant="secondary" onPress={() => void cancel()} />
      ) : null}
      <Link href={`/orders/${id}/support`} asChild>
        <Button title="Написать в поддержку" variant="text" />
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  error: { ...typography.caption, color: lightColors.danger },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginTop: 4 },
  history: { ...typography.caption, color: lightColors.textSecondary },
});
