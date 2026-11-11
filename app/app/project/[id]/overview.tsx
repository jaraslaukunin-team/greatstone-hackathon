import type { CatalogDTO, PhotoDTO, ProjectDTO } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { autoLayoutLocal, unplacedPhotos } from '../../../src/editor/autoLayoutLocal';
import { useProjectStore } from '../../../src/project/projectStore';
import { syncProject } from '../../../src/project/syncProject';
import { Button } from '../../../src/ui/Button';
import { Card } from '../../../src/ui/Card';
import { lightColors, space, typography } from '../../../src/theme/theme';

export default function OverviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const { draft, setDraft, setLayout, setSyncState } = useProjectStore();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Собираем вашу книгу…');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const project = await client.get<ProjectDTO>(`/projects/${id}`);
      const photos = await client.get<PhotoDTO[]>(`/projects/${id}/photos`);
      const catalog = await client.get<CatalogDTO>('/catalog').catch(() => null);
      const variant = catalog?.products.flatMap((p) => p.variants).find((v) => v.id === project.variantId);
      // Правки пользователя не затираем: прежний макет (локальный или с сервера) остаётся, пока в нём разложены все фото.
      const stored = useProjectStore.getState().draft;
      const previous = stored?.project.id === project.id ? stored.layout : project.layout;
      const keep =
        previous.pages.some((pg) => pg.cells.some((c) => c.photoId)) && unplacedPhotos(previous, photos).length === 0;
      const layout = keep
        ? previous
        : autoLayoutLocal(photos, { pagesMin: variant?.pagesMin ?? 20, pagesMax: variant?.pagesMax ?? 60 });
      if (cancelled) return;
      setDraft({ ...project, layout });
      setLayout(layout);
      setMessage(`Готово · ${layout.pages.length} страниц`);
      setBusy(false);
      await syncProject({
        client,
        projectId: project.id,
        layout,
        version: project.version,
        onLocalOnly: () => setSyncState('local-only'),
        onSaved: ({ version }) => {
          // Сервер на сохранение отвечает только новой версией; макет остаётся локальным.
          setDraft({ ...project, layout, version });
          setSyncState('saved');
        },
        onConflict: async (server, localLayout) => {
          setDraft({ ...server, layout: localLayout, version: server.version });
          setSyncState('local-only');
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [client, id, setDraft, setLayout, setSyncState]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Обзор книги</Text>
      <Text style={styles.sub}>{message}</Text>
      {(draft?.layout?.pages ?? []).slice(0, 8).map((page, index) => (
        <Card key={index}>
          <Text style={styles.cardTitle}>
            Разворот {index + 1} · {page.template}
          </Text>
          <Text style={styles.cardSub}>
            Фото: {page.cells.filter((c) => c.photoId).length}/{page.cells.length}
          </Text>
          <Button
            title="Открыть"
            variant="secondary"
            onPress={() => router.push(`/project/${id}/spread/${index}`)}
          />
        </Card>
      ))}
      <Button title="Проверить перед заказом" disabled={busy} onPress={() => router.push(`/project/${id}/review`)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginVertical: space[2] },
});
