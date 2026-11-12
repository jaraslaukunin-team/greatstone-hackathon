import Constants from 'expo-constants';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useT } from '../../src/i18n/useT';
import { Wordmark } from '../../src/ui/Wordmark';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export default function AboutScreen() {
  const t = useT();
  const version =
    Constants.expoConfig?.version ?? Constants.manifest?.version ?? '—';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Wordmark />
      </View>

      <Card>
        <InfoRow label={t.about.version} value={version} />
        <InfoRow label={t.about.company} value={t.about.companyValue} />
        <InfoRow label={t.about.address} value={t.about.addressValue} />
        <InfoRow label={t.about.email} value={t.about.emailValue} />
        <InfoRow label={t.about.web} value={t.about.webValue} />
      </Card>

      <Button
        title={t.about.emailValue}
        icon="phone"
        variant="secondary"
        onPress={() => void Linking.openURL(`mailto:${t.about.emailValue}`)}
      />
      <Button
        title={t.about.webValue}
        icon="eye"
        variant="secondary"
        onPress={() => void Linking.openURL(`https://${t.about.webValue}`)}
      />

      <Text style={styles.rights}>{t.about.rights}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  header: { alignItems: 'center', marginBottom: space[2] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    gap: space[3],
    minHeight: 44,
  },
  rowLabel: { ...typography.caption, color: lightColors.textSecondary, flex: 1 },
  rowValue: { ...typography.body, color: lightColors.text, flex: 2, textAlign: 'right' },
  rights: { ...typography.caption, color: lightColors.textMuted, textAlign: 'center', marginTop: space[3] },
});
