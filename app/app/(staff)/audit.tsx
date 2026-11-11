import type { AuditEntryDTO } from '@picpac/shared';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

const RESULT: Record<AuditEntryDTO['result'], string> = { ok: 'успешно', denied: 'отказано', error: 'ошибка' };

export default function StaffAuditScreen() {
  const client = useApiClient();
  const [rows, setRows] = useState<AuditEntryDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void client
      .get<AuditEntryDTO[]>('/operator/audit?limit=100')
      .then(setRows)
      .catch(() => setError('Не удалось загрузить журнал'));
  }, [client]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sub}>Последние 100 действий: кто, когда, что и с каким результатом. Журнал только дополняется.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {(rows ?? []).map((r) => (
        <Card key={r.id}>
          <Text style={styles.action}>{r.action}</Text>
          <Text style={[styles.meta, r.result === 'denied' && styles.denied]}>
            {new Date(r.at).toLocaleString('ru-RU')} · {RESULT[r.result]}
            {r.objectType ? ` · ${r.objectType}` : ''}
          </Text>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[2] },
  sub: { ...typography.body, color: lightColors.textSecondary, marginBottom: space[2] },
  action: { ...typography.bodyStrong, color: lightColors.text },
  meta: { ...typography.caption, color: lightColors.textSecondary, marginTop: 2 },
  denied: { color: lightColors.danger },
  error: { ...typography.caption, color: lightColors.danger },
});
