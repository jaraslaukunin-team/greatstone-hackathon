import type { ProjectDTO, ThemeId } from '@picpac/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function CreateEventAlbumScreen() {
  const client = useApiClient();
  const catalog = useCatalog();
  const [title, setTitle] = useState('Наша поездка');
  const [password, setPassword] = useState('');
  const [themeId, setThemeId] = useState<ThemeId>('travel');
  const [variantId, setVariantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const books = catalog.data?.products.find((p) => p.kind === 'photobook');
  const variants = books?.variants ?? [];

  useEffect(() => {
    if (!variantId && variants[0]) setVariantId(variants[0].id);
  }, [variantId, variants]);

  async function create() {
    if (!variantId) return;
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
        title: title.trim() || 'Общий альбом',
        isShared: true,
        isPool: true,
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
      <Text style={styles.title}>Общий альбом</Text>
      <Text style={styles.hint}>
        Все заливают фото в общий пул, а каждый собирает свою книгу и заказывает её отдельно.
      </Text>

      <Text style={styles.label}>Название</Text>
      <Input value={title} onChangeText={setTitle} placeholder="Например: Отпуск 2026" />

      <Text style={styles.label}>Оформление</Text>
      <ThemePicker value={themeId} onChange={setThemeId} />

      {variants.length > 0 ? (
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
        Передайте участникам и ссылку, и пароль — без пароля в альбом не войдут, даже если ссылка утечёт.
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
