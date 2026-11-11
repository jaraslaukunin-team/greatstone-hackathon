import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { ApiRequestError } from '../../src/api/client';
import { parseInviteUrl } from '../../src/album/parseInvite';
import { savePendingInvite } from '../../src/album/pendingInvite';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { lightColors, space, typography } from '../../src/theme/theme';

type State = 'accepting' | 'password' | 'done' | 'failed';

export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string; url?: string }>();
  const client = useApiClient();
  const [state, setState] = useState<State>('accepting');
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const token = params.token ?? parseInviteUrl(String(params.url ?? '')) ?? null;

  async function accept(withPassword?: string) {
    if (!token) {
      setState('failed');
      setMessage('Ссылка недействительна');
      return;
    }
    setBusy(true);
    try {
      await client.post('/invites/accept', { token, ...(withPassword === undefined ? {} : { password: withPassword }) });
      setState('done');
      router.replace('/(tabs)/designs');
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401 && e.code === 'UNAUTHORIZED') {
        // Приглашение открыли до входа: запоминаем токен, после входа оно откроется само.
        await savePendingInvite(token);
        router.replace('/(auth)/welcome');
        return;
      }
      if (e instanceof ApiRequestError && (e.code === 'PASSWORD_REQUIRED' || e.code === 'PASSWORD_INVALID')) {
        setState('password');
        setMessage(e.code === 'PASSWORD_INVALID' ? e.message : null);
      } else {
        setState('failed');
        setMessage(e instanceof ApiRequestError ? e.message : 'Не удалось принять приглашение');
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void accept();
  }, [client, token]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Приглашение в альбом</Text>
      {state === 'accepting' ? <Text style={styles.sub}>Принимаем приглашение…</Text> : null}
      {state === 'password' ? (
        <>
          <Text style={styles.sub}>Этот альбом защищён паролем. Его вам должен был передать организатор.</Text>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Пароль альбома"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="off"
          />
          {message ? <Text style={styles.error}>{message}</Text> : null}
          <Button title="Вступить" onPress={() => void accept(password)} disabled={busy || password.length === 0} />
        </>
      ) : null}
      {state === 'failed' ? <Text style={styles.error}>{message ?? 'Не удалось принять приглашение'}</Text> : null}
      <Button title="На главную" variant="text" onPress={() => router.replace('/(tabs)')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3], justifyContent: 'center' },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  error: { ...typography.caption, color: lightColors.danger },
});
