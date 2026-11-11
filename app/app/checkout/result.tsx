import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function ResultScreen() {
  const { orderId, payment } = useLocalSearchParams<{ orderId: string; payment: string }>();

  return (
    <View style={styles.screen}>
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
  title: { ...typography.display, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textMuted },
  erip: { ...typography.bodyStrong, color: lightColors.text },
});
