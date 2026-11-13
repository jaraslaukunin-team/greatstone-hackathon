import { themeById } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tr } from '../../../src/i18n/runtimeTranslate';
import { useApiClient } from '../../../src/api/hooks';
import { spreadsOf } from '../../../src/book/flip';
import { PageView } from '../../../src/book/PageView';
import { spreadRange } from '../../../src/book/spreadInfo';
import {
  applySpreadTemplate,
  applySpreadTemplateToAll,
  spreadTemplatesByPhotos,
  type SpreadTemplateId,
} from '../../../src/book/spreadTemplates';
import { useDebouncedSync } from '../../../src/project/useDebouncedSync';
import { useProjectPhotos } from '../../../src/project/useProjectPhotos';
import { useProjectStore } from '../../../src/project/projectStore';
import { Button } from '../../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../../src/theme/theme';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: '1', label: '1 фото' },
  { id: '2-3', label: '2–3' },
  { id: '4-6', label: '4–6' },
] as const;

const PREVIEW = 64;

export default function SpreadTemplatesScreen() {
  const { id, spread: spreadParam } = useLocalSearchParams<{ id: string; spread?: string }>();
  const client = useApiClient();
  const draft = useProjectStore((s) => s.draft);
  const setLayout = useProjectStore((s) => s.setLayout);
  const { photoMap, sourceOf, loading } = useProjectPhotos(client, id);
  useDebouncedSync(client, id, !!draft && draft.project.id === id);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [selected, setSelected] = useState<SpreadTemplateId>('story');
  const [scope, setScope] = useState<'one' | 'all'>('one');

  const layout = draft && draft.project.id === id ? draft.layout : null;
  const ordered = draft?.project.status === 'ordered';
  const pageCount = layout?.pages.length ?? 0;
  const spreadCount = spreadsOf(pageCount).length;
  // Обложка шаблонам не подвергается: индекс не меньше 1 и в пределах книги.
  const spread = Math.min(Math.max(1, Number(spreadParam) || 1), Math.max(1, spreadCount - 1));
  const sizes = useMemo(() => Object.fromEntries(Array.from(photoMap.values(), (p) => [p.id, { width: p.width, height: p.height }])), [photoMap]);
  const theme = themeById(layout?.themeId);
  const templates = spreadTemplatesByPhotos(filter);
  const chosen = templates.find((t) => t.id === selected) ?? templates[0];

  if (!layout) {
    return (
      <View style={styles.screen}>
        <Text style={styles.sub}>Откройте книгу из списка «Мои», затем выберите шаблон.</Text>
        <Button title="К книге" onPress={() => router.dismissTo(`/project/${id}/overview`)} />
      </View>
    );
  }
  if (spreadCount < 2) {
    return (
      <View style={styles.screen}>
        <Text style={styles.sub}>В книге пока нет разворотов, добавьте страницы.</Text>
        <Button title="Назад" onPress={() => router.back()} />
      </View>
    );
  }

  const apply = () => {
    if (!chosen || ordered) return;
    setLayout(scope === 'all' ? applySpreadTemplateToAll(layout, chosen.id, sizes) : applySpreadTemplate(layout, spread, chosen.id, sizes));
    router.back();
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Шаблоны разворота</Text>
      <Text style={styles.sub}>Разворот {spreadRange(spread, pageCount)}</Text>
      {ordered ? <Text style={styles.sub}>Проект уже заказан, редактирование недоступно.</Text> : null}

      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.id }}
            onPress={() => setFilter(f.id)}
            style={[styles.chip, filter === f.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, filter === f.id && styles.chipTextOn]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.grid}>
        {templates.map((t) => {
          const preview = applySpreadTemplate(layout, spread, t.id, sizes);
          const [l, r] = spreadsOf(pageCount)[spread] ?? [null, null];
          const on = chosen?.id === t.id;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`${tr('Шаблон')} ${tr(t.title)}, ${t.photos} ${tr('фото')}`}
              accessibilityState={{ selected: on }}
              onPress={() => setSelected(t.id)}
              style={[styles.card, on && styles.cardOn]}
            >
              <View style={styles.pair}>
                <PageView page={l === null ? null : (preview.pages[l] ?? null)} sourceOf={sourceOf} width={PREVIEW} height={PREVIEW} theme={theme} />
                <PageView page={r === null ? null : (preview.pages[r] ?? null)} sourceOf={sourceOf} width={PREVIEW} height={PREVIEW} theme={theme} />
              </View>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{tr(t.title)}</Text>
                <Text style={styles.cardSub}>{t.photos} {tr('фото')}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Применить шаблон</Text>
      <View style={styles.chips}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: scope === 'one' }} onPress={() => setScope('one')} style={[styles.chip, scope === 'one' && styles.chipOn]}>
          <Text style={[styles.chipText, scope === 'one' && styles.chipTextOn]}>Только разворот {spreadRange(spread, pageCount)}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: scope === 'all' }} onPress={() => setScope('all')} style={[styles.chip, scope === 'all' && styles.chipOn]}>
          <Text style={[styles.chipText, scope === 'all' && styles.chipTextOn]}>Все развороты</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        {scope === 'one' ? 'Остальные страницы не изменятся.' : 'Фото каждого разворота остаются на своём месте, обложка не меняется.'}
      </Text>

      <Button title={chosen ? `${tr('Применить')} «${tr(chosen.title)}»` : 'Применить'} disabled={!chosen || ordered || loading} onPress={apply} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  scroll: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  label: { ...typography.bodyStrong, color: lightColors.text },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: { minHeight: 44, paddingHorizontal: space[3], borderRadius: radius.button, backgroundColor: lightColors.surface, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: lightColors.accent },
  chipText: { ...typography.bodyStrong, color: lightColors.text },
  chipTextOn: { color: '#FFFFFF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], justifyContent: 'space-between' },
  card: { width: '48%', minWidth: PREVIEW * 2 + 24, padding: space[2], borderRadius: radius.photo * 2, borderWidth: 2, borderColor: 'transparent', backgroundColor: lightColors.surface, gap: space[2], alignItems: 'center' },
  cardOn: { borderColor: lightColors.accent },
  pair: { flexDirection: 'row', borderRadius: radius.photo, overflow: 'hidden', backgroundColor: lightColors.border },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textSecondary },
});
