import { buildAlbumLayout, type PhotoDTO, type ProjectDTO } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { useCatalog } from '../../src/catalog/useCatalog';
import { useProjectStore } from '../../src/project/projectStore';
import { ApiRequestError } from '../../src/api/client';
import { passwordProblem } from '../../src/album/password';
import { progressText } from '../../src/album/progressText';
import { useAlbumProgress } from '../../src/album/useAlbumProgress';
import { memberRows } from '../../src/album/memberRows';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { Icon } from '../../src/ui/Icon';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useApiClient();
  const { user } = useAuth();
  const catalog = useCatalog();
  const [skipped, setSkipped] = useState<string[]>([]);
  const [busyBuild, setBusyBuild] = useState(false);
  const { progress } = useAlbumProgress(client, id ?? null);
  const [project, setProject] = useState<ProjectDTO | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyCopy, setBusyCopy] = useState(false);

  useEffect(() => {
    if (!id) return;
    void client
      .get<ProjectDTO>(`/projects/${id}`)
      .then(setProject)
      .catch(() => setProject(null));
  }, [client, id]);

  useEffect(() => {
    if (!id || !project || project.status === 'ordered') return;
    let cancelled = false;
    void client
      .post<{ token: string; url: string }>(`/projects/${id}/invites`)
      .then((invite) => {
        if (!cancelled) setInviteUrl(invite.url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, id, project?.status]);

  async function ensureInviteUrl(): Promise<string | null> {
    if (inviteUrl) return inviteUrl;
    if (!id) return null;
    const invite = await client.post<{ token: string; url: string }>(`/projects/${id}/invites`);
    setInviteUrl(invite.url);
    return invite.url;
  }

  async function copyLink() {
    try {
      const url = await ensureInviteUrl();
      if (!url) return;
      const nav = (globalThis as { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } }).navigator;
      if (nav?.clipboard) {
        await nav.clipboard.writeText(url);
        setCopied(true);
        return;
      }
      await Share.share({ message: url });
      setCopied(true);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось скопировать ссылку');
    }
  }

  async function share() {
    try {
      const url = await ensureInviteUrl();
      if (!url) return;
      await Share.share({ message: url }).catch(() => undefined);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось поделиться ссылкой');
    }
  }

  async function savePassword(next: string) {
    const problem = passwordProblem(next);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    try {
      await client.put(`/projects/${id}/password`, { password: next });
      setProject((p) => (p ? { ...p, hasPassword: true } : p));
      setEditing(false);
      setPassword('');
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось сменить пароль');
    }
  }

  async function orderOwnCopy() {
    if (!id) return;
    setBusyCopy(true);
    setError(null);
    try {
      // Именная копия: имя ученика на обложке, его разворот первым.
      const copy = await client.post<ProjectDTO>(`/projects/${id}/duplicate`, { personal: true });
      router.push(`/project/${copy.id}/overview`);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось создать копию альбома');
    } finally {
      setBusyCopy(false);
    }
  }

  /** Автосборка альбома: обложка, общие развороты и личный разворот каждого ученика; результат сохраняется в проект. */
  async function buildAlbum() {
    if (!id || !project || !progress) return;
    setBusyBuild(true);
    setError(null);
    try {
      const photos = await client.get<PhotoDTO[]>(`/projects/${id}/photos`);
      const variant = catalog.data?.products.flatMap((p) => p.variants).find((v) => v.id === project.variantId);
      const limits = { pagesMin: variant?.pagesMin ?? 20, pagesMax: variant?.pagesMax ?? 40 };
      const members = progress.members.slice(1).map((m) => ({
        userId: m.userId,
        childName: m.childName,
        wish: m.wish ?? null,
        videoUrl: m.videoUrl ?? null,
      }));
      const result = buildAlbumLayout({ title: project.title, members, photos }, limits);
      const saved = await client.put<{ version: number }>(`/projects/${id}`, { layout: result.layout, version: project.version });
      const next = { ...project, layout: result.layout, version: saved.version };
      setProject(next);
      // Редактор берёт локальный черновик, если он есть: подменяем его собранным макетом.
      useProjectStore.getState().setDraft(next);
      setSkipped(
        result.skipped.map((userId) => progress.members.find((m) => m.userId === userId)?.childName?.trim() || 'Участник'),
      );
      router.push(`/project/${id}/overview`);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось собрать альбом');
    } finally {
      setBusyBuild(false);
    }
  }

  const members = memberRows(progress);
  const isOrganizer = !!project && !!user && project.ownerId === user.id;
  const ordered = project?.status === 'ordered';
  const hasPassword = project?.hasPassword ?? null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{ordered ? 'Альбом готов' : 'Сбор фотографий'}</Text>
      <Text style={styles.sub}>{progressText(progress)}</Text>

      <Button title="Загрузить фото" onPress={() => router.push(`/project/${id}/photos`)} />
      <Button
        title="Открыть макет"
        variant="secondary"
        onPress={() => router.push(`/project/${id}/overview`)}
      />
      {isOrganizer && !ordered ? (
        <Button title="Собрать альбом" disabled={busyBuild || !progress || !project} onPress={() => void buildAlbum()} />
      ) : null}
      {skipped.length > 0 ? (
        <Text style={styles.error}>Не вошли в альбом (не хватило страниц): {skipped.join(', ')}</Text>
      ) : null}

      {ordered ? (
        <>
          <Text style={styles.hint}>
            Организатор уже заказал альбом. Каждый участник может заказать свою печатную копию и оплатить её отдельно.
          </Text>
          <Button title="Заказать мою именную копию" disabled={busyCopy} onPress={() => void orderOwnCopy()} />
        </>
      ) : (
        <>
          <Button title="Поделиться ссылкой" onPress={() => void share()} />
          {inviteUrl ? (
            <>
              <Text style={styles.link} selectable>
                {inviteUrl}
              </Text>
              <Button
                title={copied ? 'Скопировано' : 'Скопировать ссылку'}
                variant="secondary"
                onPress={() => void copyLink()}
              />
            </>
          ) : null}
          <Text style={styles.hint}>
            Ссылку и пароль передайте разными каналами: если утечёт только ссылка, без пароля в альбом не войдут.
          </Text>
        </>
      )}

      {members.length > 0 ? (
        <View style={styles.members}>
          <Text style={styles.section}>Участники</Text>
          {members.map((row, i) => (
            <View key={i} style={styles.memberRow}>
              <Icon
                name={row.done ? 'check' : 'doc'}
                size={20}
                color={row.done ? lightColors.success : lightColors.textMuted}
              />
              <Text style={[styles.memberName, row.done && styles.memberDone]}>{row.name}</Text>
              <Text style={styles.memberPhotos}>
                {row.photos > 0 ? `${row.photos} фото` : '—'}
                {row.hasWish ? ' · пожелание' : ''}
                {row.hasVideo ? ' · видео' : ''}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {!ordered ? (
        <>
          <Text style={styles.section}>Пароль для входа</Text>
          <Text style={styles.sub}>
            {hasPassword === null
              ? '…'
              : hasPassword
                ? 'Вступить можно только по ссылке и паролю. Передайте участникам и то и другое.'
                : 'У этого альбома пароля нет. Задайте его, иначе вступить сможет любой, у кого есть ссылка.'}
          </Text>
          {editing ? (
            <>
              <Input
                value={password}
                onChangeText={setPassword}
                placeholder="Новый пароль"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="off"
              />
              <Button
                title="Сохранить пароль"
                onPress={() => void savePassword(password)}
                disabled={password.length === 0}
              />
              <Button title="Отмена" variant="text" onPress={() => setEditing(false)} />
            </>
          ) : (
            <Button
              title={hasPassword ? 'Сменить пароль' : 'Задать пароль'}
              variant="secondary"
              onPress={() => setEditing(true)}
            />
          )}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  title: { ...typography.h1, color: lightColors.text },
  section: { ...typography.h2, color: lightColors.text, marginTop: space[3] },
  sub: { ...typography.body, color: lightColors.textSecondary },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  link: { ...typography.caption, color: lightColors.accent },
  error: { ...typography.caption, color: lightColors.danger },
  members: { gap: space[1] },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 44,
    paddingVertical: space[1],
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  memberName: { ...typography.body, color: lightColors.textSecondary, flex: 1 },
  memberDone: { color: lightColors.text },
  memberPhotos: { ...typography.caption, color: lightColors.textMuted },
});
