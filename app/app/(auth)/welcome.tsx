import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { useAuth } from '../../src/auth/AuthProvider';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function WelcomeScreen() {
  const { loginAsGuest } = useAuth();

  return (
    <View style={styles.screen}>
      <Text style={styles.logo}>picPac</Text>
      <Text style={styles.title}>Ваши моменты. В настоящей книге.</Text>
      <Text style={styles.sub}>Выберите фото — мы разложим их сами.</Text>
      <Link href="/(auth)/login" asChild>
        <Button title="Дальше" />
      </Link>
      <Button title="Продолжить как гость" variant="text" onPress={() => void loginAsGuest()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.bg,
    padding: space[4],
    justifyContent: 'center',
    gap: space[3],
  },
  logo: { ...typography.h1, color: lightColors.accent },
  title: { ...typography.display, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textMuted, marginBottom: space[4] },
});
