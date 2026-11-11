import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function PaymentScreen() {
  const { delivery } = useLocalSearchParams<{ delivery: string }>();
  const [method, setMethod] = useState<'card' | 'erip' | 'courier'>('card');

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Оплата</Text>
      <Text style={styles.hint}>Тестовый режим · деньги не списываются</Text>
      {(['card', 'erip', 'courier'] as const).map((id) => (
        <Card key={id}>
          <Text style={styles.cardTitle}>
            {id === 'card' ? 'Карта' : id === 'erip' ? 'ЕРИП' : 'Курьеру при получении'}
          </Text>
          <Button
            title={method === id ? 'Выбрано' : 'Выбрать'}
            variant={method === id ? 'primary' : 'secondary'}
            onPress={() => setMethod(id)}
            disabled={id === 'courier' && delivery !== 'courier_minsk'}
          />
        </Card>
      ))}
      <Button
        title="Подтвердить"
        onPress={() =>
          router.push({
            pathname: '/checkout/confirm',
            params: { delivery, payment: method },
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
