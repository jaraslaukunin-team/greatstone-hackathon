import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { useAuth } from '../../src/auth/AuthProvider';
import { lightColors, radius, space, typography } from '../../src/theme/theme';
import { ApiRequestError } from '../../src/api/client';

export default function LoginScreen() {
  const { requestCode, loginAsGuest } = useAuth();
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      await requestCode(contact.trim());
      router.push({ pathname: '/(auth)/code', params: { contact: contact.trim() } });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Рады видеть вас</Text>
      <Text style={styles.sub}>Войдите или начните без регистрации</Text>
      <TextInput
        style={styles.input}
        placeholder="Телефон или e-mail"
        placeholderTextColor={lightColors.textMuted}
        autoCapitalize="none"
        value={contact}
        onChangeText={setContact}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Получить код" onPress={() => void onSubmit()} disabled={loading || !contact.trim()} />
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
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textMuted },
  input: {
    backgroundColor: lightColors.surfaceMuted,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: lightColors.border,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    ...typography.body,
    color: lightColors.text,
  },
  error: { ...typography.caption, color: lightColors.danger },
});
