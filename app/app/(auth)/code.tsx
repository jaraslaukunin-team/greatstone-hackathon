import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { useAuth } from '../../src/auth/AuthProvider';
import { lightColors, radius, space, typography } from '../../src/theme/theme';
import { ApiRequestError } from '../../src/api/client';

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
      <Text style={styles.title}>Код подтверждения</Text>
      <Text style={styles.sub}>Отправили на {contact}</Text>
      <TextInput
        style={styles.input}
        placeholder="000000"
        placeholderTextColor={lightColors.textMuted}
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
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textMuted },
  input: {
    backgroundColor: lightColors.surfaceMuted,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: lightColors.border,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    ...typography.h2,
    color: lightColors.text,
    letterSpacing: 8,
  },
  error: { ...typography.caption, color: lightColors.danger },
});
