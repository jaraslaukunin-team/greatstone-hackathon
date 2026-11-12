import { formatByn, type DeliveryMethodId, type PickupPoint } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCatalog } from '../../src/catalog/useCatalog';
import { useAddressStore, isOutsideCourierZone, validateAddress } from '../../src/checkout/addressStore';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { Input } from '../../src/ui/Input';
import { lightColors, space, typography } from '../../src/theme/theme';

const FALLBACK: { id: DeliveryMethodId; title: string; hint: string; pickupPoints?: PickupPoint[] }[] = [
  { id: 'courier_minsk', title: 'Курьер по Минску', hint: 'Оплата при получении' },
  { id: 'ems', title: 'EMS', hint: 'Бесплатно от 300 BYN' },
  { id: 'belpost', title: 'Белпочта', hint: 'Бесплатно от 150 BYN' },
];

export default function DeliveryScreen() {
  const { promoCode } = useLocalSearchParams<{ promoCode?: string }>();
  const catalog = useCatalog();
  const saved = useAddressStore((s) => s.address);
  const setAddress = useAddressStore((s) => s.setAddress);
  const [selected, setSelected] = useState<DeliveryMethodId>('belpost');
  const [recipient, setRecipient] = useState(saved?.recipient ?? '');
  const [phone, setPhone] = useState(saved?.phone ?? '');
  const [city, setCity] = useState(saved?.city ?? '');
  const [street, setStreet] = useState(saved?.street ?? '');
  const [postalCode, setPostalCode] = useState(saved?.postalCode ?? '');
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(saved?.pickupPointId ?? null);
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
        pickupPoints: d.pickupPoints,
      }))
    : FALLBACK;

  const selectedMethod = methods.find((m) => m.id === selected);
  const pickupPoints = selectedMethod?.pickupPoints ?? [];
  const isBelpost = selected === 'belpost';
  const isCourierMinsk = selected === 'courier_minsk';

  function next() {
    const problem = validateAddress(
      {
        recipient,
        phone,
        city,
        street: isBelpost && selectedPickupId ? 'pickup' : street,
        pickupPointId: isBelpost ? (selectedPickupId ?? undefined) : undefined,
      },
      selected,
    );
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setAddress({
      recipient: recipient.trim(),
      phone: phone.trim(),
      city: city.trim(),
      street: isBelpost && selectedPickupId ? undefined : street.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      pickupPointId: isBelpost ? (selectedPickupId ?? undefined) : undefined,
    });
    router.push({ pathname: '/checkout/payment', params: { delivery: selected, promoCode: promoCode ?? '' } });
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
            onPress={() => { setSelected(method.id); setError(null); }}
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
      {error && isOutsideCourierZone(error) ? (
        <Text style={styles.zoneError}>Курьер работает только по Минску. Выберите другой способ доставки.</Text>
      ) : null}
      {isBelpost && pickupPoints.length > 0 ? (
        <View style={styles.pickupSection}>
          <Text style={styles.pickupLabel}>Пункт выдачи заказа</Text>
          {pickupPoints.map((pp) => (
            <Pressable
              key={pp.id}
              accessibilityRole="button"
              style={[styles.pickupItem, selectedPickupId === pp.id && styles.pickupItemActive]}
              onPress={() => setSelectedPickupId(pp.id)}
            >
              <Text style={styles.pickupTitle}>{pp.title}</Text>
              <Text style={styles.pickupAddress}>{pp.address}</Text>
            </Pressable>
          ))}
          <Text style={styles.pickupOr}>или укажите адрес вручную</Text>
        </View>
      ) : null}
      {(!isBelpost || !selectedPickupId) ? (
        <>
          <Input value={street} onChangeText={setStreet} placeholder="Улица, дом, квартира" autoComplete="street-address" />
          <Input
            value={postalCode}
            onChangeText={setPostalCode}
            placeholder="Индекс (необязательно)"
            keyboardType="number-pad"
            autoComplete="postal-code"
          />
        </>
      ) : null}
      {error && !isOutsideCourierZone(error) ? <Text style={styles.error}>{error}</Text> : null}
      {!isCourierMinsk || !error ? (
        <Button title="К оплате" onPress={next} />
      ) : (
        <Button title="К оплате" onPress={next} />
      )}
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
  zoneError: { ...typography.caption, color: lightColors.danger },
  pickupSection: { gap: space[2] },
  pickupLabel: { ...typography.label, color: lightColors.textSecondary },
  pickupItem: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 12,
    padding: space[3],
    minHeight: 56,
  },
  pickupItemActive: {
    borderColor: lightColors.action,
    backgroundColor: lightColors.accentSoft,
  },
  pickupTitle: { ...typography.bodyStrong, color: lightColors.text },
  pickupAddress: { ...typography.caption, color: lightColors.textSecondary, marginTop: 2 },
  pickupOr: { ...typography.caption, color: lightColors.textSecondary, textAlign: 'center' },
});
