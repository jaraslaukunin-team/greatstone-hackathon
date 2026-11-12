import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function PaymentErrorScreen() {
  const { delivery } = useLocalSearchParams<{ delivery?: string }>();

  return (
    <View style={styles.screen}>
      <View style={styles.badge}>
        <Icon name="x" size={40} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>Ошибка оплаты</Text>
      <Text style={styles.sub}>Не удалось провести оплату. Попробуйте ещё раз или выберите другой способ.</Text>
      <Button
        title="Попробовать снова"
        onPress={() =>
          router.replace({
            pathname: '/checkout/payment',
            params: { delivery: delivery ?? 'belpost' },
          })
        }
      />
      <Button title="В корзину" variant="secondary" onPress={() => router.replace('/(tabs)/cart')} />
      <Button title="На главную" variant="text" onPress={() => router.replace('/(tabs)')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.bg,
    padding: space[4],
    gap: space[3],
    justifyContent: 'center',
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: lightColors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: { ...typography.display, color: lightColors.text, textAlign: 'center' },
  sub: { ...typography.body, color: lightColors.textSecondary, textAlign: 'center' },
});
