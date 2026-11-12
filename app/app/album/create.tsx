import { DEFAULT_THEME_ID, type ProjectDTO, type ThemeId } from '@picpac/shared';
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

const SHARED_EXPECTED_MEMBERS = 25;

export default function CreateAlbumScreen() {
  const client = useApiClient();
  const catalog = useCatalog();
  const [title, setTitle] = useState('');
  const [shared, setShared] = useState(false);
  const [password, setPassword] = useState('');
  const [themeId, setThemeId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [selectedVariant, setVariantId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const variants = shared
    ? (catalog.data?.products.find((p) => p.kind === 'graduation')?.variants ?? [])
    : (catalog.data?.products.filter((p) => p.kind === 'photobook').flatMap((p) => p.variants) ?? []);
  const firstVariantId = variants[0]?.id ?? null;
  const variantId =
    selectedVariant && variants.some((v) => v.id === selectedVariant)
      ? selectedVariant
      : firstVariantId;

  // При смене «общий / личный» список форматов другой — берём первый доступный.
  useEffect(() => {
    setVariantId(firstVariantId);
  }, [shared, firstVariantId]);

  async function create() {
    if (!variantId) return;
    if (shared) {
      const problem = passwordProblem(password);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setError(null);
    setBusy(true);
    try {
      const project = await client.post<ProjectDTO>(
        '/projects',
        shared
          ? {
              variantId,
              title: title.trim() || 'Выпускная фотокнига',
              isShared: true,
              expectedMembers: SHARED_EXPECTED_MEMBERS,
              joinPassword: password,
            }
          : {
              variantId,
              title: title.trim() || 'Моя фотокнига',
              isShared: false,
            },
      );
      useThemeChoice.getState().set(project.id, themeId);
      if (shared) router.push(`/album/${project.id}`);
      else router.push(`/project/${project.id}/photos`);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : 'Не удалось создать фотокнигу');
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    Boolean(variantId) && !busy && (!shared || passwordProblem(password) === null);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Создать фотокнигу</Text>

      <Text style={styles.label}>Название</Text>
      <Input
        value={title}
        onChangeText={setTitle}
        placeholder={shared ? 'Например: 11 Б, 2027' : 'Например: Отпуск 2026'}
      />

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

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: shared }}
        onPress={() => {
          setShared((v) => {
            const next = !v;
            setThemeId(next ? 'graduation' : DEFAULT_THEME_ID);
            return next;
          });
        }}
        style={styles.checkRow}
      >
        <View style={[styles.checkBox, shared && styles.checkBoxOn]}>
          {shared ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
        <View style={styles.checkCopy}>
          <Text style={styles.label}>Общая фотокнига</Text>
          <Text style={styles.hint}>
            Другие смогут присоединиться по ссылке и паролю. Без галочки — личная фотокнига только для вас.
          </Text>
        </View>
      </Pressable>

      {shared ? (
        <View style={styles.section}>
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
            В фотокнигу вступят только те, кому вы передали и ссылку, и пароль. Пароль можно сменить позже, убрать его
            нельзя.
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Создать" onPress={() => void create()} disabled={!canSubmit} />
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
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    minHeight: 44,
    paddingVertical: space[1],
  },
  checkBox: {
    width: 24,
    height: 24,
    marginTop: 2,
    borderRadius: radius.photo,
    borderWidth: 2,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBoxOn: {
    borderColor: lightColors.action,
    backgroundColor: lightColors.action,
  },
  checkMark: { color: lightColors.textOnAccent, fontSize: 14, fontWeight: '700' },
  checkCopy: { flex: 1, gap: space[1] },
});
