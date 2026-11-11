import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function ProfileDataScreen() {
  const client = useApiClient();
  const { logout } = useAuth();
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setError(null);
    try {
      await client.delete('/me/data');
      await logout();
      router.replace('/(auth)/welcome');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить данные');
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Мои данные</Text>
      <Text style={styles.sub}>
        Удалим проекты, фото и AI-задачи. Заказы в истории останутся без привязки к вам.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Удалить всё" onPress={() => void onDelete()} />
      <Button title="Отмена" variant="text" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textMuted },
  error: { ...typography.caption, color: lightColors.danger },
});
