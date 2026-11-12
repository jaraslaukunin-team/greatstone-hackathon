import { checkQuality, type CatalogDTO, type PhotoDTO, type ProjectDTO } from '@picpac/shared';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { useAuth } from '../../../src/auth/AuthProvider';
import {
  canProceed,
  issueDetail,
  issueKey,
  issueTitle,
} from '../../../src/editor/quality';
import { useProjectStore } from '../../../src/project/projectStore';
import { Button } from '../../../src/ui/Button';
import { StateBanner } from '../../../src/ui/StateBanner';
import { Card } from '../../../src/ui/Card';
import { lightColors, space, typography } from '../../../src/theme/theme';

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const { user } = useAuth();
  const { draft } = useProjectStore();
  const [acked, setAcked] = useState<string[]>([]);
  const review = useQuery({
    queryKey: ['order-review', user?.id, id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const [project, photoList, catalog] = await Promise.all([
        client.get<ProjectDTO>(`/projects/${id}`),
        client.get<PhotoDTO[]>(`/projects/${id}/photos`),
        client.get<CatalogDTO>('/catalog').catch(() => null),
      ]);
      const variant = catalog?.products.flatMap((p) => p.variants).find((v) => v.id === project.variantId);
      return {
        layout: project.layout,
        photos: Object.fromEntries(photoList.map((p) => [p.id, p])),
        pageWidthCm: variant?.pageWidthCm ?? 20,
      };
    },
  });
  const layout = draft?.project.id === id ? draft?.layout : review.data?.layout;
  const issues = useMemo(
    () => (layout && review.data ? checkQuality(layout, review.data.photos, { pageWidthCm: review.data.pageWidthCm }) : []),
    [layout, review.data],
  );
  const ready = review.isSuccess && !review.isFetching && canProceed(issues, acked);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Проверка перед заказом</Text>
      {review.isError ? (
        <StateBanner title="Не удалось проверить макет" tone="danger" actionLabel="Повторить" onAction={() => void review.refetch()} />
      ) : review.isPending || review.isFetching ? (
        <Text style={styles.sub}>Проверяем макет…</Text>
      ) : issues.length === 0 ? (
        <Text style={styles.sub}>Замечаний нет</Text>
      ) : (
        issues.map((issue) => (
          <Card key={issueKey(issue)}>
            <Text style={styles.cardTitle}>
              {issueTitle(issue)} · стр. {issue.pageIndex + 1}
            </Text>
            <Text style={styles.cardSub}>
              {issue.severity === 'blocker' ? 'Блокирует заказ' : 'Предупреждение'}
            </Text>
            <Text style={styles.cardDetail}>{issueDetail(issue)}</Text>
            {issue.severity === 'warning' ? (
              <Button
                title="Оставить как есть"
                variant="secondary"
                onPress={() => setAcked((prev) => [...new Set([...prev, issueKey(issue)])])}
              />
            ) : (
              <Button
                title="Исправить"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/project/[id]/overview', params: { id: String(id), page: String(issue.pageIndex) } })
                }
              />
            )}
          </Card>
        ))
      )}
      <Button
        title="Оформить"
        disabled={!ready}
        onPress={() => router.push('/(tabs)/cart')}
      />
      {!ready && review.isSuccess && !review.isFetching ? (
        <Text style={styles.hint}>Сначала закройте блокеры и подтвердите предупреждения</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], paddingBottom: space[7], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text, marginTop: space[5] },
  sub: { ...typography.body, color: lightColors.textSecondary },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginTop: space[1] },
  cardDetail: { ...typography.body, color: lightColors.textSecondary, marginVertical: space[2] },
  hint: { ...typography.caption, color: lightColors.warning },
});
