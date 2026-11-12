import type { PhotoDTO } from '@picpac/shared';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../api/hooks';
import { markSeen } from '../editor/reconcileLayout';
import { useProjectStore } from '../project/projectStore';
import { lightColors, space, typography } from '../theme/theme';
import { Button } from '../ui/Button';
import { pickPhotos } from './pickPhotos';

export function AddProjectPhotos({ projectId, onAdded }: {
  projectId: string;
  onAdded(photo: PhotoDTO): void;
}) {
  const client = useApiClient();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const picked = await pickPhotos();
      for (const photo of picked) {
        const uploaded = await client.upload<PhotoDTO>(`/projects/${projectId}/photos`, { uri: photo.uri });
        onAdded(uploaded);
        const { draft, setLayout } = useProjectStore.getState();
        if (draft?.project.id === projectId) setLayout(markSeen(draft.layout, [uploaded.id]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.controls}>
      <Button
        title={busy ? 'Загружаем…' : '+ Фото'}
        accessibilityLabel="Добавить фото с телефона"
        variant="secondary"
        disabled={busy}
        onPress={() => void add()}
      />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { alignSelf: 'flex-start', gap: space[1], maxWidth: '100%' },
  error: { ...typography.caption, color: lightColors.danger },
});
