import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { useAuth } from '../../src/auth/AuthProvider';
import { lightColors, space, typography } from '../../src/theme/theme';
import { ApiRequestError } from '../../src/api/client';
import { BackButton } from '../../src/ui/BackButton';

export default function CodeScreen() {
  const { contact } = useLocalSearchParams<{ contact: string }>();
  const { verifyCode } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      await verifyCode(String(contact ?? ''), code.trim());
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Неверный код');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.back}>
        <BackButton fallback="/(auth)/welcome" />
      </View>
      <Text style={styles.title}>Код подтверждения</Text>
      <Text style={styles.sub}>Отправили на {contact}</Text>
      <Input
        style={styles.code}
        placeholder="000000"
        keyboardType="number-pad"
        value={code}
        onChangeText={setCode}
        maxLength={6}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Войти" onPress={() => void onSubmit()} disabled={loading || code.length < 4} />
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
  back: { position: 'absolute', top: space[5], left: space[2] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  code: { ...typography.h2, letterSpacing: 8 },
  error: { ...typography.caption, color: lightColors.danger },
});
