import type { DeliveryMethodId } from '@picpac/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

const METHODS: Array<{ id: DeliveryMethodId; title: string; hint: string }> = [
  { id: 'courier_minsk', title: 'Курьер по Минску', hint: 'Оплата при получении' },
  { id: 'ems', title: 'EMS', hint: 'Бесплатно от 300 BYN' },
  { id: 'belpost', title: 'Белпочта', hint: 'Бесплатно от 150 BYN' },
];

export default function DeliveryScreen() {
  const [selected, setSelected] = useState<DeliveryMethodId>('belpost');

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Доставка</Text>
      {METHODS.map((method) => (
        <Card key={method.id}>
          <Text style={styles.cardTitle}>{method.title}</Text>
          <Text style={styles.cardSub}>{method.hint}</Text>
          <Button
            title={selected === method.id ? 'Выбрано' : 'Выбрать'}
            variant={selected === method.id ? 'primary' : 'secondary'}
            onPress={() => setSelected(method.id)}
          />
        </Card>
      ))}
      <Button
        title="К оплате"
        onPress={() =>
          router.push({ pathname: '/checkout/payment', params: { delivery: selected } })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textMuted, marginVertical: space[2] },
});
