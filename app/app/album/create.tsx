import type { ProjectDTO } from '@picpac/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiRequestError } from '../../src/api/client';
import { useApiClient } from '../../src/api/hooks';
import { passwordProblem } from '../../src/album/password';
import { useCatalog } from '../../src/catalog/useCatalog';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function CreateAlbumScreen() {
  const client = useApiClient();
  const catalog = useCatalog();
  const [title, setTitle] = useState('11 Б, 2027');
  const [expected, setExpected] = useState('25');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const graduation = catalog.data?.products.find((p) => p.kind === 'graduation');
  const variantId = graduation?.variants[0]?.id;

  async function create() {
    if (!variantId) return;
    const problem = password ? passwordProblem(password) : null;
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const project = await client.post<ProjectDTO>('/projects', {
        variantId,
        title,
        isShared: true,
        expectedMembers: Number(expected) || 1,
        ...(password ? { joinPassword: password } : {}),
      });
      router.push(`/album/${project.id}`);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось создать альбом');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Выпускной альбом</Text>
      <Input value={title} onChangeText={setTitle} />
      <Input value={expected} onChangeText={setExpected} keyboardType="number-pad" placeholder="Число учеников" />
      <Input
        value={password}
        onChangeText={setPassword}
        placeholder="Пароль для входа (необязательно)"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="off"
      />
      <Text style={styles.hint}>
        С паролем в альбом вступят только те, кому вы передали и ссылку, и пароль. Так фото детей не попадут к чужим, даже
        если ссылка утечёт.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Создать" onPress={() => void create()} disabled={busy || !variantId} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  error: { ...typography.caption, color: lightColors.danger },
});
