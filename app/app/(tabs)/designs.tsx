import type { ProjectDTO } from '@picpac/shared';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useProjectStore } from '../../src/project/projectStore';
import { Card } from '../../src/ui/Card';
import { StateBanner } from '../../src/ui/StateBanner';
import { lightColors, space, typography } from '../../src/theme/theme';
import { EmptyState } from '../../src/ui/EmptyState';
import { Button } from '../../src/ui/Button';

export default function DesignsScreen() {
  const client = useApiClient();
  const { draft, syncState, setDraft } = useProjectStore();
  const [items, setItems] = useState<ProjectDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await client.get<ProjectDTO[]>('/projects');
      setItems(list);
    } catch {
      setError('Не удалось загрузить проекты');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [client]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Мои дизайны</Text>
      {syncState === 'local-only' && draft ? (
        <StateBanner title="Черновик только на телефоне" message={draft.project.title} tone="warning" />
      ) : null}
      {loading ? <ActivityIndicator color={lightColors.accent} /> : null}
      {error ? (
        <StateBanner title={error} actionLabel="Повторить" onAction={() => void load()} tone="danger" />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState icon="folder" title="Черновиков пока нет" message="Соберите фотокнигу — она сохранится здесь">
          <Link href="/catalog/books" asChild>
            <Button title="Выбрать фотокнигу" icon="plus" />
          </Link>
        </EmptyState>
      ) : null}
      {items.map((project) => (
        <Link
          key={project.id}
          href={`/project/${project.id}/overview`}
          onPress={() => setDraft(project)}
          asChild
        >
          <Card chevron>
            <Text style={styles.cardTitle}>{project.title}</Text>
            <Text style={styles.cardSub}>
              {project.status === 'draft' ? 'Черновик' : 'В заказе'} · v{project.version}
            </Text>
          </Card>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3], paddingTop: space[7] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginTop: 4 },
});
