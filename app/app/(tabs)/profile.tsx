import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { getNetworkFailure, setNetworkFailure } from '../../src/dev/networkFailure';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const client = useApiClient();
  const [failNetwork, setFailNetwork] = useState(getNetworkFailure());
  const [message, setMessage] = useState<string | null>(null);

  async function deleteData() {
    setMessage(null);
    try {
      await client.delete('/me/data');
      await logout();
      router.replace('/(auth)/welcome');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось удалить данные');
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Профиль</Text>
      <Text style={styles.sub}>{user?.displayName ?? 'Гость'}</Text>
      <Text style={styles.meta}>Роль: {user?.role ?? '—'}</Text>

      {user?.role === 'operator' ? (
        <Button title="Очередь оператора" onPress={() => router.push('/operator/queue')} />
      ) : null}

      <Button title="Мои данные" variant="secondary" onPress={() => router.push('/profile/data')} />
      <Button title="Поддержка" variant="secondary" onPress={() => router.push('/profile/support')} />

      <View style={styles.row}>
        <Text style={styles.label}>Имитация сбоя сети</Text>
        <Switch
          value={failNetwork}
          onValueChange={(value) => {
            setFailNetwork(value);
            setNetworkFailure(value);
          }}
        />
      </View>

      <Button title="Удалить мои данные" variant="secondary" onPress={() => void deleteData()} />
      <Button
        title="Выйти"
        variant="text"
        onPress={() => {
          void logout().then(() => router.replace('/(auth)/welcome'));
        }}
      />
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <Text style={styles.meta}>API: {process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], paddingTop: space[7], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textMuted },
  meta: { ...typography.caption, color: lightColors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  label: { ...typography.body, color: lightColors.text },
  error: { ...typography.caption, color: lightColors.danger },
});
