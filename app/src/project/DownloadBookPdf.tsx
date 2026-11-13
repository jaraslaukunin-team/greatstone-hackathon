import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../api/hooks';
import { tr } from '../i18n/runtimeTranslate';
import { lightColors, space } from '../theme/theme';
import { Button } from '../ui/Button';

export function DownloadBookPdf({ projectId }: { projectId: string }) {
  const client = useApiClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    const path = `/projects/${projectId}/pdf`;
    const filename = 'picpac-book.pdf';
    try {
      if (Platform.OS === 'web' && client.downloadPdf) {
        const url = URL.createObjectURL(await client.downloadPdf(path));
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const destination = `${FileSystem.cacheDirectory}${filename}`;
        const file = await FileSystem.downloadAsync(client.resolveUrl(path), destination, { headers: client.fileHeaders?.() });
        if (file.status !== 200) throw new Error(tr('Не удалось скачать PDF'));
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Не удалось скачать PDF'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Button title={tr(busy ? 'Готовим PDF…' : 'Скачать PDF')} variant="secondary" disabled={busy} onPress={() => void download()} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2], marginTop: space[2] },
  error: { color: lightColors.danger },
});
