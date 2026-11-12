import type { OrderDTO, ProjectDTO } from '@picpac/shared';
import { statusLabel } from '../orders/statusLabel';
import { formatByn } from '@picpac/shared';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../api/hooks';
import { useProjectStore } from '../project/projectStore';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { StateBanner } from '../ui/StateBanner';
import { lightColors, space, typography } from '../theme/theme';
import { EmptyState } from '../ui/EmptyState';

export function OrderList({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const client = useApiClient();
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const loadVersion = useRef(0);
  const setDraft = useProjectStore((s) => s.setDraft);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    try {
      const next = await client.get<OrderDTO[]>('/orders');
      if (version === loadVersion.current) setOrders(next);
    } catch {
      if (version === loadVersion.current) setError('Не удалось загрузить заказы');
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [client]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { loadVersion.current += 1; };
  }, [load]));

  async function runAction(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Не удалось выполнить действие');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  const visibleOrders = favoritesOnly ? orders.filter((order) => order.favorite) : orders;
  return (
    <>
      {loading ? <ActivityIndicator color={lightColors.accent} /> : null}
      {error ? (
        <StateBanner title={error} actionLabel="Повторить" onAction={() => void load()} tone="danger" />
      ) : null}
      {!loading && !error && visibleOrders.length === 0 ? (
        <EmptyState
          icon="doc"
          title={favoritesOnly ? 'Избранных заказов пока нет' : 'Пока нет заказов'}
          message={favoritesOnly ? 'Отметьте нужный заказ на вкладке «Заказы»' : 'Оформленные заказы и их статусы появятся здесь'}
        />
      ) : null}
      {actionError ? <StateBanner title={actionError} tone="danger" /> : null}
      {visibleOrders.map((order) => (
        <Card key={order.id}>
          <Link href={`/orders/${order.id}`} asChild>
            <Pressable accessibilityRole="link" style={styles.orderLink}>
              <Text style={styles.cardTitle}>{order.number}</Text>
              <Text style={styles.cardSub}>
                {statusLabel(order.status)} · {formatByn(order.totalKop)}
              </Text>
            </Pressable>
          </Link>
          <View style={styles.actions}>
            <Button
              title={order.favorite ? 'Убрать из избранного' : 'В избранное'}
              variant="secondary"
              disabled={busy || loading}
              onPress={() => void runAction(async () => {
                const updated = await client.post<OrderDTO>(`/orders/${order.id}/favorite`, { favorite: !order.favorite });
                setOrders((current) => current.map((item) => item.id === updated.id ? updated : item));
              })}
            />
            {order.projectId ? (
              <Button
                title="Повторить заказ"
                variant="dark"
                disabled={busy || loading}
                onPress={() => void runAction(async () => {
                  const copy = await client.post<ProjectDTO>(`/orders/${order.id}/repeat`);
                  setDraft(copy);
                  router.push(`/project/${copy.id}/overview`);
                })}
              />
            ) : null}
          </View>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  orderLink: { minHeight: 44, justifyContent: 'center' },
  actions: { gap: space[2], marginTop: space[2] },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginTop: 4 },
});
