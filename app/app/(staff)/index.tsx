import { formatByn, type OrderDTO, type OrderStatus } from '@picpac/shared';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { statusLabel } from '../../src/orders/statusLabel';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { EmptyState } from '../../src/ui/EmptyState';
import { lightColors, space, typography } from '../../src/theme/theme';

const FILTERS: { id: OrderStatus | 'all'; title: string }[] = [
  { id: 'all', title: 'Все' },
  { id: 'accepted', title: 'Принятые' },
  { id: 'moderation', title: 'Проверка' },
  { id: 'production', title: 'В печати' },
  { id: 'ready_for_delivery', title: 'К отправке' },
];

export default function StaffOrdersScreen() {
  const client = useApiClient();
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const path = filter === 'all' ? '/operator/orders' : `/operator/orders?status=${filter}`;
    void client
      .get<OrderDTO[]>(path)
      .then((next) => {
        if (active) setOrders(next);
      })
      .catch(() => {
        if (active) setError('Не удалось загрузить заказы');
      });
    return () => { active = false; };
  }, [client, filter]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <Button
            key={f.id}
            title={f.title}
            variant={f.id === filter ? 'primary' : 'secondary'}
            onPress={() => {
              if (f.id === filter) return;
              setOrders(null);
              setError(null);
              setFilter(f.id);
            }}
          />
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {orders && orders.length === 0 ? <EmptyState icon="doc" title="Заказов нет" message="В этом статусе пусто" /> : null}
      {(orders ?? []).map((order) => (
        <Link key={order.id} href={`/operator/order/${order.id}`} asChild>
          <Card chevron>
            <Text style={styles.cardTitle}>{order.number}</Text>
            <Text style={styles.cardSub}>
              {statusLabel(order.status)} · {formatByn(order.totalKop)}
            </Text>
          </Card>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginTop: 4 },
  error: { ...typography.caption, color: lightColors.danger },
});
