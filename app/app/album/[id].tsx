import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAlbumProgress } from '../../src/album/useAlbumProgress';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const { progress } = useAlbumProgress(client, id ?? null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  async function share() {
    const invite = await client.post<{ token: string; url: string }>(`/albums/${id}/invite`);
    setInviteUrl(invite.url);
    await Share.share({ message: invite.url });
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Сбор фотографий</Text>
      <Text style={styles.sub}>
        {progress ? `${progress.members.length} из ${progress.expected} добавили` : '…'}
      </Text>
      <Button title="Поделиться ссылкой" onPress={() => void share()} />
      {inviteUrl ? <Text style={styles.link}>{inviteUrl}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textMuted },
  link: { ...typography.caption, color: lightColors.accent },
});
