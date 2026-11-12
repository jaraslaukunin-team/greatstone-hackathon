import type { ProjectDTO } from '@picpac/shared';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { useCatalog } from '../../src/catalog/useCatalog';
import { ProjectMenu, type ProjectMenuAction } from '../../src/designs/ProjectMenu';
import { OrderList } from '../../src/orders/OrderList';
import { projectKind, projectKindLabel } from '../../src/project/projectKind';
import { useProjectStore } from '../../src/project/projectStore';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { ConfirmDialog } from '../../src/ui/ConfirmDialog';
import { EmptyState } from '../../src/ui/EmptyState';
import { Input } from '../../src/ui/Input';
import { StateBanner } from '../../src/ui/StateBanner';
import { CardSkeleton } from '../../src/ui/Skeleton';
import { staggerDelay } from '../../src/ui/motion';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

export default function DesignsScreen() {
  const client = useApiClient();
  const { ready, token } = useAuth();
  const catalog = useCatalog();
  const { draft, syncState, setDraft } = useProjectStore();
  const [tab, setTab] = useState<'projects' | 'favorites'>('projects');
  const [items, setItems] = useState<ProjectDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuProject, setMenuProject] = useState<ProjectDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDTO | null>(null);
  const [renameTarget, setRenameTarget] = useState<ProjectDTO | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
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
  }, [client]);

  useFocusEffect(useCallback(() => {
    if (ready && token && tab === 'projects') void load();
  }, [load, ready, token, tab]));

  function openProject(project: ProjectDTO) {
    setDraft(project);
    router.push(`/project/${project.id}/overview`);
  }

  async function handleMenuAction(action: ProjectMenuAction) {
    const project = menuProject;
    setMenuProject(null);
    if (!project) return;

    if (action === 'open') {
      openProject(project);
      return;
    }
    if (action === 'rename') {
      setRenameValue(project.title);
      setRenameTarget(project);
      return;
    }
    if (action === 'delete') {
      setDeleteTarget(project);
      return;
    }
    if (action === 'duplicate') {
      setBusy(true);
      try {
        const copy = await client.post<ProjectDTO>(`/projects/${project.id}/duplicate`);
        setItems((prev) => [copy, ...prev]);
        openProject(copy);
      } catch {
        Alert.alert('Не удалось дублировать проект');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (action === 'share') {
      try {
        const invite = await client.post<{ token: string; url: string }>(`/projects/${project.id}/invites`);
        await Share.share({ message: invite.url }).catch(() => undefined);
      } catch {
        Alert.alert('Не удалось создать ссылку');
      }
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await client.delete(`/projects/${deleteTarget.id}`);
      setItems((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      if (draft?.project.id === deleteTarget.id) {
        useProjectStore.getState().clear();
      }
      setDeleteTarget(null);
    } catch {
      Alert.alert('Не удалось удалить проект');
    } finally {
      setBusy(false);
    }
  }

  async function confirmRename() {
    if (!renameTarget) return;
    const title = renameValue.trim();
    if (!title) return;
    setBusy(true);
    try {
      const updated = await client.patch<ProjectDTO>(`/projects/${renameTarget.id}`, { title });
      setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (draft?.project.id === updated.id) setDraft(updated);
      setRenameTarget(null);
    } catch {
      Alert.alert('Не удалось переименовать');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Мои дизайны</Text>
      <View style={styles.tabs}>
        <Button title="Дизайны" accessibilityRole="tab" accessibilityState={{ selected: tab === 'projects' }}
          variant={tab === 'projects' ? 'dark' : 'secondary'} style={styles.tab} onPress={() => setTab('projects')} />
        <Button title="Избранное" accessibilityRole="tab" accessibilityState={{ selected: tab === 'favorites' }}
          variant={tab === 'favorites' ? 'dark' : 'secondary'} style={styles.tab} onPress={() => setTab('favorites')} />
      </View>
      {tab === 'favorites' ? <OrderList favoritesOnly /> : (
        <>
          {syncState === 'local-only' && draft ? (
            <StateBanner title="Черновик только на телефоне" message={draft.project.title} tone="warning" />
          ) : null}
          {loading && items.length === 0 ? <CardSkeleton /> : null}
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

          {items.map((project, index) => {
            const kind = projectKindLabel(projectKind(project, catalog.data));
            const inOrder = project.status === 'ordered';
            return (
              <View key={project.id} style={styles.row}>
                <Pressable
                  style={styles.cardPress}
                  onPress={() => openProject(project)}
                  accessibilityRole="link"
                  accessibilityLabel={project.title}
                >
                  <Card
                    chevron
                    tone={inOrder ? 'mint' : 'plain'}
                    style={styles.card}
                    delay={staggerDelay(index)}
                  >
                    <Text style={styles.cardTitle}>{project.title}</Text>
                    <Text style={[styles.cardSub, inOrder && styles.cardSubOrdered]}>
                      {kind} · {inOrder ? 'В заказе' : 'Черновик'} · v{project.version}
                    </Text>
                  </Card>
                </Pressable>
                <Pressable
                  style={styles.menuBtn}
                  onPress={() => setMenuProject(project)}
                  accessibilityRole="button"
                  accessibilityLabel="Меню проекта"
                  disabled={busy}
                >
                  <Text style={styles.menuDots}>⋯</Text>
                </Pressable>
              </View>
            );
          })}
        </>
      )}

      <ProjectMenu
        visible={!!menuProject}
        project={menuProject}
        onClose={() => setMenuProject(null)}
        onAction={(a) => void handleMenuAction(a)}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Удалить проект?"
        message={deleteTarget ? `«${deleteTarget.title}» будет удалён без возможности восстановления.` : undefined}
        confirmLabel="Удалить"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <Modal
        visible={!!renameTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameTarget(null)}
      >
        <Pressable style={styles.renameBackdrop} onPress={() => setRenameTarget(null)}>
          <Pressable style={styles.renameBox} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.renameTitle}>Переименовать</Text>
            <Input value={renameValue} onChangeText={setRenameValue} placeholder="Название" autoFocus />
            <View style={styles.renameActions}>
              <Button title="Отмена" variant="secondary" onPress={() => setRenameTarget(null)} style={styles.renameBtn} />
              <Button
                title="Сохранить"
                variant="dark"
                disabled={!renameValue.trim() || busy}
                onPress={() => void confirmRename()}
                style={styles.renameBtn}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3], paddingTop: space[7], paddingBottom: space[7] },
  title: { ...typography.h1, color: lightColors.text },
  tabs: { flexDirection: 'row', gap: space[2] },
  tab: { flex: 1, paddingHorizontal: space[2] },
  row: { position: 'relative' },
  cardPress: { flex: 1 },
  // Место справа: меню (44) + зазор + шеврон Card (~28) + отступ
  card: { paddingRight: space[4] + 44 + 8 + 28 },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary, marginTop: 4 },
  cardSubOrdered: { color: lightColors.success, fontWeight: '600' },
  menuBtn: {
    position: 'absolute',
    // Слева от шеврона (он у Card: right space[3], иконка 24)
    right: space[3] + 28 + 4,
    top: 0,
    bottom: 0,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  menuDots: { ...typography.h2, color: lightColors.text, lineHeight: 28 },
  renameBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 36, 34, 0.45)',
    justifyContent: 'center',
    padding: space[5],
  },
  renameBox: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.sheet,
    padding: space[5],
    gap: space[3],
  },
  renameTitle: { ...typography.h3, color: lightColors.text },
  renameActions: { flexDirection: 'row', gap: space[3] },
  renameBtn: { flex: 1 },
});
