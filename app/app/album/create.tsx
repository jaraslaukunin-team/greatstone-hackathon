import type { ProjectDTO, ThemeId } from '@picpac/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ApiRequestError } from '../../src/api/client';
import { useApiClient } from '../../src/api/hooks';
import { passwordProblem } from '../../src/album/password';
import { useCatalog } from '../../src/catalog/useCatalog';
import { useThemeChoice } from '../../src/project/themeChoiceStore';
import { ThemePicker } from '../../src/theme/ThemePicker';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

const EXPECTED_MIN = 1;
const EXPECTED_MAX = 100;

export default function CreateAlbumScreen() {
  const client = useApiClient();
  const catalog = useCatalog();
  const [title, setTitle] = useState('11 Б, 2027');
  const [expected, setExpected] = useState('25');
  const [password, setPassword] = useState('');
  const [themeId, setThemeId] = useState<ThemeId>('graduation');
  const [selectedVariant, setVariantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const graduation = catalog.data?.products.find((p) => p.kind === 'graduation');
  const variants = graduation?.variants ?? [];

  const variantId = selectedVariant ?? variants[0]?.id;

  async function create() {
    if (!variantId) return;
    const n = Number(expected);
    if (!Number.isInteger(n) || n < EXPECTED_MIN || n > EXPECTED_MAX) {
      setError(`Укажите число учеников от ${EXPECTED_MIN} до ${EXPECTED_MAX}`);
      return;
    }
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const project = await client.post<ProjectDTO>('/projects', {
        variantId,
        title: title.trim() || 'Выпускной альбом',
        isShared: true,
        expectedMembers: n,
        joinPassword: password,
      });
      useThemeChoice.getState().set(project.id, themeId);
      router.push(`/album/${project.id}`);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось создать альбом');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Выпускной альбом</Text>

      <Text style={styles.label}>Класс / название</Text>
      <Input value={title} onChangeText={setTitle} placeholder="Например: 11 Б, 2027" />

      <Text style={styles.label}>Оформление</Text>
      <ThemePicker value={themeId} onChange={setThemeId} />

      {variants.length > 1 ? (
        <View style={styles.section}>
          <Text style={styles.label}>Формат</Text>
          <View style={styles.chips}>
            {variants.map((v) => {
              const active = v.id === variantId;
              return (
                <Pressable
                  key={v.id}
                  accessibilityRole="button"
                  onPress={() => setVariantId(v.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{v.format}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <Text style={styles.label}>Число учеников</Text>
      <Input
        value={expected}
        onChangeText={setExpected}
        keyboardType="number-pad"
        placeholder={`От ${EXPECTED_MIN} до ${EXPECTED_MAX}`}
      />

      <Text style={styles.label}>Пароль для входа</Text>
      <Input
        value={password}
        onChangeText={setPassword}
        placeholder="Обязательно"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="off"
      />
      <Text style={styles.hint}>
        В альбом вступят только те, кому вы передали и ссылку, и пароль. Так фото детей не попадут к чужим, даже если
        ссылка утечёт. Пароль можно сменить позже, убрать его нельзя.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Создать" onPress={() => void create()} disabled={busy || !variantId || password.length === 0} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3], paddingBottom: space[7] },
  title: { ...typography.h1, color: lightColors.text },
  section: { gap: space[2] },
  label: { ...typography.bodyStrong, color: lightColors.text },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  error: { ...typography.caption, color: lightColors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    minHeight: 44,
    paddingHorizontal: space[3],
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  chipActive: { backgroundColor: lightColors.action, borderColor: lightColors.action },
  chipText: { ...typography.label, color: lightColors.text },
  chipTextActive: { color: lightColors.textOnAccent },
});
