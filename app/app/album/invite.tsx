import type { ProjectDTO } from '@picpac/shared';
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

type State = 'accepting' | 'join' | 'done' | 'failed';

export default function InviteScreen() {
  const params = useLocalSearchParams<{ token?: string; url?: string }>();
  const client = useApiClient();
  const [state, setState] = useState<State>('accepting');
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [childName, setChildName] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(true);
  const token = params.token ?? parseInviteUrl(String(params.url ?? '')) ?? null;

  async function accept(opts?: { password?: string; childName?: string }) {
    if (!token) {
      setState('failed');
      setMessage('Ссылка недействительна');
      return;
    }
    setBusy(true);
    try {
      const body: { token: string; password?: string; childName?: string } = { token };
      if (opts?.password !== undefined) body.password = opts.password;
      if (opts?.childName?.trim()) body.childName = opts.childName.trim();
      const project = await client.post<ProjectDTO>('/invites/accept', body);
      setState('done');
      // Участник приходит загружать свои фото, а не собирать книгу: ведём сразу на загрузку.
      router.replace(`/project/${project.id}/photos`);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401 && e.code === 'UNAUTHORIZED') {
        await savePendingInvite(token);
        router.replace('/(auth)/welcome');
        return;
      }
      if (e instanceof ApiRequestError && (e.code === 'PASSWORD_REQUIRED' || e.code === 'PASSWORD_INVALID')) {
        setNeedsPassword(true);
        setState('join');
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

  const canJoin =
    childName.trim().length > 0 && (!needsPassword || password.length > 0) && !busy;

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Приглашение в альбом</Text>
      {state === 'accepting' ? <Text style={styles.sub}>Принимаем приглашение…</Text> : null}
      {state === 'join' ? (
        <>
          <Text style={styles.sub}>
            {needsPassword
              ? 'Этот альбом защищён паролем. Укажите имя ученика и пароль от организатора.'
              : 'Укажите имя ученика, чтобы организатор видел, кто добавил фото.'}
          </Text>
          <Text style={styles.label}>Имя ученика</Text>
          <Input
            value={childName}
            onChangeText={setChildName}
            placeholder="Как в альбоме"
            autoCapitalize="words"
          />
          {needsPassword ? (
            <>
              <Text style={styles.label}>Пароль альбома</Text>
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="Пароль"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="off"
              />
            </>
          ) : null}
          {message ? <Text style={styles.error}>{message}</Text> : null}
          <Button
            title="Вступить"
            onPress={() =>
              void accept({
                password: needsPassword ? password : undefined,
                childName,
              })
            }
            disabled={!canJoin}
          />
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
  label: { ...typography.bodyStrong, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  error: { ...typography.caption, color: lightColors.danger },
});
