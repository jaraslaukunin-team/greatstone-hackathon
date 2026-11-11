import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function ProfileSupportScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Поддержка</Text>
      <Text style={styles.sub}>Напишите нам — ответим в рабочие часы.</Text>
      <Button title="Email support@picpac.by" onPress={() => void Linking.openURL('mailto:support@picpac.by')} />
      <Button
        title="Instagram @picpac_by"
        variant="secondary"
        onPress={() => void Linking.openURL('https://instagram.com/picpac_by')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
});
