import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { useAuth } from '../../src/auth/AuthProvider';
import { useRoleMode } from '../../src/auth/roleStore';
import { useT } from '../../src/i18n/useT';
import { lightColors, space, typography } from '../../src/theme/theme';
import { ApiRequestError } from '../../src/api/client';
import { BackButton } from '../../src/ui/BackButton';

export default function LoginScreen() {
  const { requestCode, loginAsGuest } = useAuth();
  const staff = useRoleMode((s) => s.mode) === 'staff';
  const demoHint = process.env.EXPO_PUBLIC_DEMO_HINT === '1';
  const t = useT();
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
      <View style={styles.back}>
        <BackButton fallback="/(auth)/role" />
      </View>
      <Text style={styles.title}>{staff ? t.login.titleStaff : t.login.titleCustomer}</Text>
      <Text style={styles.sub}>{staff ? t.login.subStaff : t.login.subCustomer}</Text>
      {staff && demoHint ? <Text style={styles.sub}>{t.login.demoHint}</Text> : null}
      <Input
        placeholder={t.login.placeholder}
        autoCapitalize="none"
        value={contact}
        onChangeText={setContact}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title={t.login.send}
        onPress={() => void onSubmit()}
        disabled={loading || !contact.trim()}
      />
      {staff ? null : (
        <Button
          title={t.login.continueGuest}
          variant="text"
          onPress={() => void loginAsGuest()}
        />
      )}
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
  error: { ...typography.caption, color: lightColors.danger },
});
