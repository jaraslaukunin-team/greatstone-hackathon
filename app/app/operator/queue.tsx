import type { OrderDTO } from '@picpac/shared';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function OperatorQueueScreen() {
  const client = useApiClient();
  const [orders, setOrders] = useState<OrderDTO[]>([]);

  useEffect(() => {
    void client.get<OrderDTO[]>('/orders').then(setOrders).catch(() => setOrders([]));
  }, [client]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Очередь заказов</Text>
      {orders.map((order) => (
        <Link key={order.id} href={`/operator/order/${order.id}`} asChild>
          <Card>
            <Text style={styles.cardTitle}>{order.number}</Text>
            <Text style={styles.cardSub}>{order.status}</Text>
          </Card>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textMuted, marginTop: 4 },
});
