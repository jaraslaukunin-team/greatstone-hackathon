import { formatByn, type DeliveryMethodId } from '@picpac/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useCatalog } from '../../src/catalog/useCatalog';
import { useAddressStore, validateAddress } from '../../src/checkout/addressStore';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { Input } from '../../src/ui/Input';
import { lightColors, space, typography } from '../../src/theme/theme';

const FALLBACK: Array<{ id: DeliveryMethodId; title: string; hint: string }> = [
  { id: 'courier_minsk', title: 'Курьер по Минску', hint: 'Оплата при получении' },
  { id: 'ems', title: 'EMS', hint: 'Бесплатно от 300 BYN' },
  { id: 'belpost', title: 'Белпочта', hint: 'Бесплатно от 150 BYN' },
];

export default function DeliveryScreen() {
  const catalog = useCatalog();
  const saved = useAddressStore((s) => s.address);
  const setAddress = useAddressStore((s) => s.setAddress);
  const [selected, setSelected] = useState<DeliveryMethodId>('belpost');
  const [recipient, setRecipient] = useState(saved?.recipient ?? '');
  const [phone, setPhone] = useState(saved?.phone ?? '');
  const [city, setCity] = useState(saved?.city ?? '');
  const [street, setStreet] = useState(saved?.street ?? '');
  const [postalCode, setPostalCode] = useState(saved?.postalCode ?? '');
  const [error, setError] = useState<string | null>(null);

  const methods = catalog.data?.delivery.length
    ? catalog.data.delivery.map((d) => ({
        id: d.id,
        title: d.title,
        hint: [
          d.priceKop > 0 ? formatByn(d.priceKop) : 'Бесплатно',
          `${d.etaDays[0]}–${d.etaDays[1]} дн.`,
          d.freeFromKop ? `бесплатно от ${formatByn(d.freeFromKop)}` : null,
          d.payOnDelivery ? 'оплата при получении' : null,
        ]
          .filter(Boolean)
          .join(' · '),
      }))
    : FALLBACK;

  function next() {
    const problem = validateAddress({ recipient, phone, city, street });
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setAddress({
      recipient: recipient.trim(),
      phone: phone.trim(),
      city: city.trim(),
      street: street.trim(),
      postalCode: postalCode.trim() || undefined,
    });
    router.push({ pathname: '/checkout/payment', params: { delivery: selected } });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Доставка</Text>
      {methods.map((method) => (
        <Card key={method.id}>
          <Text style={styles.cardTitle}>{method.title}</Text>
          <Text style={styles.cardSub}>{method.hint}</Text>
          <Button
            title={selected === method.id ? 'Выбрано' : 'Выбрать'}
            icon={selected === method.id ? 'check' : undefined}
            variant={selected === method.id ? 'primary' : 'secondary'}
            onPress={() => setSelected(method.id)}
          />
        </Card>
      ))}
      <Text style={styles.section}>Кому и куда</Text>
      <Input value={recipient} onChangeText={setRecipient} placeholder="Имя получателя" autoComplete="name" />
      <Input
        value={phone}
        onChangeText={setPhone}
        placeholder="Телефон, +375 29 123-45-67"
        keyboardType="phone-pad"
        autoComplete="tel"
      />
      <Input value={city} onChangeText={setCity} placeholder="Город" autoComplete="postal-address-locality" />
      <Input value={street} onChangeText={setStreet} placeholder="Улица, дом, квартира" autoComplete="street-address" />
      <Input
        value={postalCode}
        onChangeText={setPostalCode}
        placeholder="Индекс (необязательно)"
        keyboardType="number-pad"
        autoComplete="postal-code"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="К оплате" onPress={next} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  section: { ...typography.h2, color: lightColors.text, marginTop: space[2] },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginVertical: space[2] },
  error: { ...typography.caption, color: lightColors.danger },
});
