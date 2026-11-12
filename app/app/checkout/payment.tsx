import type { DeliveryMethodId } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PAYMENT_LABELS, paymentOptions } from '../../src/checkout/paymentOptions';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function PaymentScreen() {
  const { delivery, promoCode } = useLocalSearchParams<{ delivery: DeliveryMethodId; promoCode?: string }>();
  const options = paymentOptions((delivery ?? 'belpost') as DeliveryMethodId);
  const [method, setMethod] = useState<(typeof options)[number]>(options[0]!);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Оплата</Text>
      <Text style={styles.hint}>Тестовый режим · деньги не списываются</Text>
      {options.map((id) => (
        <Card key={id}>
          <Text style={styles.cardTitle}>{PAYMENT_LABELS[id]}</Text>
          <Button
            title={method === id ? 'Выбрано' : 'Выбрать'}
            variant={method === id ? 'primary' : 'secondary'}
            onPress={() => setMethod(id)}
          />
        </Card>
      ))}
      <Button
        title="Подтвердить"
        onPress={() =>
          router.push({
            pathname: '/checkout/confirm',
            params: { delivery, payment: method, promoCode: promoCode ?? '' },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  hint: { ...typography.caption, color: lightColors.warning },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text, marginBottom: space[2] },
});
