import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';
import { Icon } from '../../src/ui/Icon';

export default function ResultScreen() {
  const { orderId, payment } = useLocalSearchParams<{ orderId: string; payment: string }>();

  return (
    <View style={styles.screen}>
      <View style={styles.badge}>
        <Icon name="check" size={44} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>Заказ принят</Text>
      <Text style={styles.sub}>Номер внутри приложения · тестовый режим</Text>
      {payment === 'erip' ? (
        <Text style={styles.erip}>ЕРИП: 000000000000000000000000000</Text>
      ) : null}
      <Button title="К заказу" onPress={() => router.replace(`/orders/${orderId}`)} />
      <Button title="На главную" variant="text" onPress={() => router.replace('/(tabs)')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3], justifyContent: 'center' },
  badge: { width: 88, height: 88, borderRadius: 44, backgroundColor: lightColors.success, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.display, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  erip: { ...typography.bodyStrong, color: lightColors.text },
});
