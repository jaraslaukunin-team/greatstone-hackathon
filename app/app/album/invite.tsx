import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { parseInviteUrl } from '../../src/album/parseInvite';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string; url?: string }>();
  const client = useApiClient();
  const [status, setStatus] = useState('Принятие приглашения…');
  const token = params.token ?? parseInviteUrl(String(params.url ?? '')) ?? null;

  useEffect(() => {
    if (!token) {
      setStatus('Ссылка недействительна');
      return;
    }
    void client
      .post('/albums/accept', { token })
      .then(() => {
        setStatus('Вы в альбоме');
        router.replace('/(tabs)/designs');
      })
      .catch(() => setStatus('Не удалось принять приглашение'));
  }, [client, token]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Приглашение</Text>
      <Text style={styles.sub}>{status}</Text>
      <Button title="На главную" variant="text" onPress={() => router.replace('/(tabs)')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3], justifyContent: 'center' },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textMuted },
});
