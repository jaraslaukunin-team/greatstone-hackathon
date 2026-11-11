import type { ProjectDTO } from '@picpac/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { ApiRequestError } from '../../src/api/client';
import { passwordProblem } from '../../src/album/password';
import { progressText } from '../../src/album/progressText';
import { useAlbumProgress } from '../../src/album/useAlbumProgress';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const { progress } = useAlbumProgress(client, id ?? null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void client
      .get<ProjectDTO>(`/projects/${id}`)
      .then((p) => setHasPassword(p.hasPassword))
      .catch(() => setHasPassword(null));
  }, [client, id]);

  async function copyLink() {
    // В браузере буфер обмена доступен через navigator; на телефоне ссылку отправляют кнопкой «Поделиться».
    const nav = (globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } }).navigator;
    if (!inviteUrl || !nav?.clipboard) return;
    await nav.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  async function share() {
    const invite = await client.post<{ token: string; url: string }>(`/projects/${id}/invites`);
    setInviteUrl(invite.url);
    await Share.share({ message: invite.url }).catch(() => undefined);
  }

  async function savePassword(next: string) {
    const problem = passwordProblem(next);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      await client.put(`/projects/${id}/password`, { password: next });
      setHasPassword(true);
      setEditing(false);
      setPassword('');
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось сменить пароль');
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Сбор фотографий</Text>
      <Text style={styles.sub}>
        {progressText(progress)}
      </Text>
      <Button title="Поделиться ссылкой" onPress={() => void share()} />
      {inviteUrl ? (
        <>
          <Text style={styles.link} selectable>
            {inviteUrl}
          </Text>
          <Button title={copied ? 'Скопировано' : 'Скопировать ссылку'} variant="secondary" onPress={() => void copyLink()} />
        </>
      ) : null}

      <Text style={styles.section}>Пароль для входа</Text>
      <Text style={styles.sub}>
        {hasPassword === null
          ? '…'
          : hasPassword
            ? 'Вступить можно только по ссылке и паролю. Передайте участникам и то и другое.'
            : 'У этого альбома пароля нет. Задайте его, иначе вступить сможет любой, у кого есть ссылка.'}
      </Text>
      {editing ? (
        <>
          <Input
            value={password}
            onChangeText={setPassword}
            placeholder="Новый пароль"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="off"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Сохранить пароль" onPress={() => void savePassword(password)} disabled={password.length === 0} />
          <Button title="Отмена" variant="text" onPress={() => setEditing(false)} />
        </>
      ) : (
        <>
          <Button title={hasPassword ? 'Сменить пароль' : 'Задать пароль'} variant="secondary" onPress={() => setEditing(true)} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  section: { ...typography.h2, color: lightColors.text, marginTop: space[3] },
  sub: { ...typography.body, color: lightColors.textSecondary },
  link: { ...typography.caption, color: lightColors.accent },
  error: { ...typography.caption, color: lightColors.danger },
});
