import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAddressStore } from '../../src/checkout/addressStore';
import { useT } from '../../src/i18n/useT';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function AddressesScreen() {
  const t = useT();
  const address = useAddressStore((s) => s.address);
  const setAddress = useAddressStore((s) => s.setAddress);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.addresses.title}</Text>
      {address ? (
        <Card>
          <Text style={styles.row}>
            <Text style={styles.label}>{t.addresses.recipientLabel}: </Text>
            {address.recipient}
          </Text>
          <Text style={styles.row}>
            <Text style={styles.label}>{t.addresses.phoneLabel}: </Text>
            {address.phone}
          </Text>
          <Text style={styles.row}>
            <Text style={styles.label}>{t.addresses.cityLabel}: </Text>
            {address.city}
          </Text>
          <Text style={styles.row}>
            <Text style={styles.label}>{t.addresses.streetLabel}: </Text>
            {address.street}
          </Text>
        </Card>
      ) : (
        <Text style={styles.empty}>{t.addresses.empty}</Text>
      )}
      {address ? (
        <Button
          title={t.addresses.clearButton}
          variant="secondary"
          icon="trash"
          onPress={() => setAddress(null)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  empty: { ...typography.body, color: lightColors.textSecondary },
  row: { ...typography.body, color: lightColors.text, marginTop: 2 },
  label: { ...typography.bodyStrong, color: lightColors.text },
});
