import type { OrderDTO } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function ResultScreen() {
  const { orderId, payment } = useLocalSearchParams<{ orderId: string; payment: string }>();
  const client = useApiClient();
  const [order, setOrder] = useState<OrderDTO | null>(null);

  useEffect(() => {
    if (!orderId) return;
    void client.get<OrderDTO>(`/orders/${orderId}`).then(setOrder).catch(() => null);
  }, [client, orderId]);

  const eripNumber = order?.eripNumber ?? null;

  return (
    <View style={styles.screen}>
      <View style={styles.badge}>
        <Icon name="check" size={44} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>Заказ принят</Text>
      <Text style={styles.sub}>Номер внутри приложения · тестовый режим</Text>
      {payment === 'erip' ? (
        <View style={styles.eripBlock}>
          <Text style={styles.eripLabel}>Код ЕРИП</Text>
          <Text style={styles.erip} accessibilityLabel="Код ЕРИП">
            {eripNumber ?? '000000000000000000000000000'}
          </Text>
          <Text style={styles.eripHint}>27 цифр · введите в системе ЕРИП для оплаты</Text>
        </View>
      ) : null}
      <Button title="К заказу" onPress={() => router.replace(`/orders/${orderId}`)} />
      <Button title="На главную" variant="text" onPress={() => router.replace('/(tabs)')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3], justifyContent: 'center' },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: lightColors.success,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: { ...typography.display, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  eripBlock: { gap: space[1] },
  eripLabel: { ...typography.label, color: lightColors.textSecondary },
  erip: { ...typography.bodyStrong, color: lightColors.text, letterSpacing: 1 },
  eripHint: { ...typography.caption, color: lightColors.textSecondary },
});
