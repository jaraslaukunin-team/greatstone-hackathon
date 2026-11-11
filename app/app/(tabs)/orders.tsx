import type { OrderDTO } from '@picpac/shared';
import { formatByn } from '@picpac/shared';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { Card } from '../../src/ui/Card';
import { StateBanner } from '../../src/ui/StateBanner';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function OrdersScreen() {
  const client = useApiClient();
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setOrders(await client.get<OrderDTO[]>('/orders'));
      setError(null);
    } catch {
      setError('Не удалось загрузить заказы');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [client]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Заказы</Text>
      {loading ? <ActivityIndicator color={lightColors.accent} /> : null}
      {error ? (
        <StateBanner title={error} actionLabel="Повторить" onAction={() => void load()} tone="danger" />
      ) : null}
      {!loading && orders.length === 0 ? <Text style={styles.sub}>Пока нет заказов</Text> : null}
      {orders.map((order) => (
        <Link key={order.id} href={`/orders/${order.id}`} asChild>
          <Card>
            <Text style={styles.cardTitle}>{order.number}</Text>
            <Text style={styles.cardSub}>
              {order.status} · {formatByn(order.totalKop)}
            </Text>
          </Card>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3], paddingTop: space[7] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textMuted },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textMuted, marginTop: 4 },
});
