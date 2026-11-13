import { formatByn, type ProjectDTO } from '@picpac/shared';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { tr } from '../../src/i18n/runtimeTranslate';
import { useSettingsStore } from '../../src/settings/settingsStore';
import { statusLabel } from '../../src/orders/statusLabel';
import { orderStatusTone } from '../../src/orders/statusTone';
import { statusSteps } from '../../src/orders/statusSteps';
import { useOrderPolling } from '../../src/orders/useOrderPolling';
import { useProjectStore } from '../../src/project/projectStore';
import { DownloadBookPdf } from '../../src/project/DownloadBookPdf';
import { ListSkeleton } from '../../src/ui/Skeleton';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { ToastHost } from '../../src/ui/Toast';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lang = useSettingsStore((state) => state.lang);
  const client = useApiClient();
  const setDraft = useProjectStore((s) => s.setDraft);
  const { order, error } = useOrderPolling({ client, orderId: id ?? null, intervalMs: 5000 });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const steps = order ? statusSteps(order.status) : [];
  const tone = orderStatusTone(order?.status);

  async function cancel() {
    setActionError(null);
    setBusy(true);
    try {
      await client.post(`/orders/${id}/cancel`);
    } catch {
      setActionError('Не удалось отменить заказ');
    } finally {
      setBusy(false);
    }
  }

  async function reorder() {
    if (!order?.projectId) return;
    setActionError(null);
    setBusy(true);
    try {
      const copy = await client.post<ProjectDTO>(`/orders/${order.id}/repeat`);
      setDraft(copy);
      router.push(`/project/${copy.id}/overview`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось повторить заказ');
    } finally {
      setBusy(false);
    }
  }

  if (!order && !error) return <ListSkeleton count={2} />;

  return (
    <View style={styles.root}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>{order?.number ?? 'Заказ'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

        <Card style={{ backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }}>
          <Text style={[styles.cardTitle, { color: tone.statusColor }]}>
            {tr('Статус:')} {tr(statusLabel(order?.status))}
          </Text>
          <Text style={styles.cardSub}>{order ? formatByn(order.totalKop) : ''}</Text>
          {order?.projectId ? <DownloadBookPdf projectId={order.projectId} /> : null}
        {order?.status === 'cancelled' ? (
            <Text style={styles.cancelNote}>Заказ отменён</Text>
          ) : null}
        </Card>

        {order && order.status !== 'cancelled' ? (
          <Card>
            <Text style={styles.timelineTitle}>Ход заказа</Text>
            <View style={styles.timeline}>
              {steps.map((step, index) => {
                const stepTone = orderStatusTone(step.status);
                return (
                  <View key={step.status} style={styles.stepRow}>
                    <View style={styles.rail}>
                      <View
                        style={[
                          styles.dot,
                          step.reached && { backgroundColor: stepTone.borderColor },
                          step.current && {
                            backgroundColor: stepTone.statusColor,
                            width: 14,
                            height: 14,
                            borderRadius: 7,
                          },
                        ]}
                      />
                      {index < steps.length - 1 ? (
                        <View
                          style={[
                            styles.line,
                            step.reached && !step.current && { backgroundColor: stepTone.borderColor },
                          ]}
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        step.current && [styles.stepLabelCurrent, { color: stepTone.statusColor }],
                        !step.reached && styles.stepLabelMuted,
                      ]}
                    >
                      {tr(step.label)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>
        ) : null}

        {(order?.history ?? []).map((item, index) => (
          <Text key={`${item.status}-${index}`} style={[styles.history, { color: orderStatusTone(item.status).statusColor }]}>
            {tr(statusLabel(item.status))} · {new Date(item.at).toLocaleString(lang)}
          </Text>
        ))}

        {order?.status === 'accepted' ? (
          <Button title="Отменить заказ" variant="secondary" disabled={busy} onPress={() => void cancel()} />
        ) : order && order.status !== 'cancelled' ? (
          <Text style={styles.hint}>Отменить можно только в статусе «Принят»</Text>
        ) : null}

        {order?.projectId ? (
          <Button title="Повторить заказ" variant="dark" disabled={busy} onPress={() => void reorder()} />
        ) : null}

        <Link href={`/orders/${id}/support`} asChild>
          <Button title="Написать в поддержку" variant="text" />
        </Link>
      </ScrollView>
      <ToastHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: lightColors.bg },
  screen: { flex: 1 },
  content: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  title: { ...typography.h1, color: lightColors.text },
  error: { ...typography.caption, color: lightColors.danger },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginTop: 4 },
  cancelNote: { ...typography.caption, color: lightColors.danger, marginTop: space[2] },
  timelineTitle: { ...typography.bodyStrong, color: lightColors.text, marginBottom: space[3] },
  timeline: { gap: 0 },
  stepRow: { flexDirection: 'row', minHeight: 44, gap: space[3] },
  rail: { width: 20, alignItems: 'center' },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: lightColors.border,
    marginTop: 4,
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 20,
    backgroundColor: lightColors.border,
    marginVertical: 2,
  },
  stepLabel: { ...typography.body, color: lightColors.text, flex: 1, paddingTop: 0 },
  stepLabelCurrent: { ...typography.bodyStrong },
  stepLabelMuted: { color: lightColors.textMuted },
  history: { ...typography.caption, color: lightColors.textSecondary },
  hint: { ...typography.caption, color: lightColors.textSecondary },
});
