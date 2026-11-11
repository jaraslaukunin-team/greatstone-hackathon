import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { PrintStack } from '../../src/ui/PrintStack';
import { Wordmark } from '../../src/ui/Wordmark';
import { useAuth } from '../../src/auth/AuthProvider';
import { useRoleMode } from '../../src/auth/roleStore';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function WelcomeScreen() {
  const { loginAsGuest } = useAuth();
  const setMode = useRoleMode((s) => s.setMode);

  return (
    <View style={styles.screen}>
      <Wordmark />
      <View style={styles.art}>
        <PrintStack size={150} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Ваши моменты. В{' '}настоящей книге.</Text>
        <Text style={styles.sub}>Выберите фото — мы разложим их сами.</Text>
      </View>
      <View style={styles.actions}>
        <Link href="/(auth)/role" asChild>
          <Button title="Дальше" />
        </Link>
        <Button title="Продолжить как гость" variant="text" onPress={() => {
            setMode('customer');
            void loginAsGuest();
          }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.bg,
    padding: space[4],
    paddingTop: space[7],
    paddingBottom: space[5],
    gap: space[4],
  },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  copy: { gap: space[2] },
  title: { ...typography.display, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  actions: { gap: space[1] },
});
