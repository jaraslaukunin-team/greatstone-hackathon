import { themeById } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { cellRects } from '../../../src/book/cellRects';
import { spreadsOf } from '../../../src/book/flip';
import { PageView } from '../../../src/book/PageView';
import { spreadPhotoCount, spreadRange } from '../../../src/book/spreadInfo';
import { TEXT_STYLES, TEXT_STYLE_IDS } from '../../../src/book/textStyles';
import { addPageText, MAX_PAGE_TEXTS, replacePhoto, setCrop, setPageBg, setPageGap } from '../../../src/editor/editorActions';
import { useProjectStore } from '../../../src/project/projectStore';
import { useDebouncedSync } from '../../../src/project/useDebouncedSync';
import { useProjectPhotos } from '../../../src/project/useProjectPhotos';
import { Button } from '../../../src/ui/Button';
import { Slider } from '../../../src/ui/Slider';
import { lightColors, radius, space, typography } from '../../../src/theme/theme';

type Tab = 'template' | 'gap' | 'bg' | 'text';
const TABS: { id: Tab; label: string }[] = [
  { id: 'template', label: 'Шаблон' },
  { id: 'gap', label: 'Отступы' },
  { id: 'bg', label: 'Фон' },
  { id: 'text', label: 'Текст' },
];
// Фоны страницы: те же оттенки палитры, что в редакторе страницы.
const BACKGROUNDS = [lightColors.surface, lightColors.fillRose, lightColors.fillSand, lightColors.fillMint, lightColors.fillSky, lightColors.fillLilac];
const THUMB = 76;

export default function PlaceScreen() {
  const { id, spread: spreadParam } = useLocalSearchParams<{ id: string; spread?: string }>();
  const client = useApiClient();
  const { width: winW } = useWindowDimensions();
  const draft = useProjectStore((s) => s.draft);
  const setLayout = useProjectStore((s) => s.setLayout);
  const { photoList, sourceOf } = useProjectPhotos(client, id);
  const [tab, setTab] = useState<Tab>('template');
  const [cell, setCell] = useState<{ pageIndex: number; cellIndex: number } | null>(null);
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [gapPreview, setGapPreview] = useState<number | null>(null);
  // Автосохранение: если книга открыта под этим экраном, она и сохраняет; при прямой ссылке — этот экран.
  useDebouncedSync(client, id, !!draft && draft.project.id === id);

  const layout = draft && draft.project.id === id ? draft.layout : null;
  // Выбранная ячейка могла пропасть после смены шаблона.
  const cellValid = cell && layout?.pages[cell.pageIndex]?.cells[cell.cellIndex] ? cell : null;
  const ordered = draft?.project.status === 'ordered';
  const pageCount = layout?.pages.length ?? 0;
  const spreads = spreadsOf(pageCount);
  const spread = Math.min(Math.max(1, Number(spreadParam) || 1), Math.max(1, spreads.length - 1));
  const [leftIndex, rightIndex] = spreads[spread] ?? [null, null];
  const theme = themeById(layout?.themeId);
  const placed = useMemo(() => new Set(layout?.pages.flatMap((p) => p.cells.map((c) => c.photoId).filter(Boolean) as string[]) ?? []), [layout]);

  if (!layout || spreads.length < 2 || leftIndex === null) {
    return (
      <View style={styles.stub}>
        <Text style={styles.sub}>Откройте книгу, затем выберите разворот для правки.</Text>
        <Button title="К книге" onPress={() => router.dismissTo(`/project/${id}/overview`)} />
      </View>
    );
  }

  const pageW = Math.min(170, (winW - space[4] * 2 - 24) / 2);
  const pageIdx = [leftIndex, rightIndex].filter((i): i is number => i !== null);
  const currentGap = layout.pages[leftIndex]?.gap ?? theme.marginPct;
  const gapValue = gapPreview ?? currentGap;
  const applyGap = (value: number | null) => {
    let next = layout;
    for (const i of pageIdx) next = setPageGap(next, i, value);
    setLayout(next);
  };

  const place = () => {
    if (!cellValid || !photoId || ordered) return;
    // Новое фото ставится с нейтральным кадром: кадр прежнего (например, половины панорамы) ему не подходит.
    setLayout(setCrop(replacePhoto(layout, cellValid, photoId), cellValid, { x: 0, y: 0, scale: 1, rotation: 0 }));
    setPhotoId(null);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Расставить фото</Text>
      <Text style={styles.sub}>
        Разворот {spreadRange(spread, pageCount)} · {spreadPhotoCount(layout, spread)} фото
      </Text>
      {ordered ? <Text style={styles.sub}>Проект уже заказан, редактирование недоступно.</Text> : null}

      <View style={styles.spreadBox}>
        {pageIdx.map((pi) => {
          const page = layout.pages[pi]!;
          const view = gapPreview === null ? page : { ...page, gap: gapPreview };
          const rects = cellRects(view.template, pageW, pageW, view.cells.length, theme, view.gap);
          return (
            <View key={pi} style={{ width: pageW, height: pageW }}>
              <PageView page={view} sourceOf={sourceOf} width={pageW} height={pageW} theme={theme} />
              {rects.map((r, ci) => {
                const on = cellValid?.pageIndex === pi && cellValid.cellIndex === ci;
                return (
                  <Pressable
                    key={ci}
                    accessibilityRole="button"
                    accessibilityLabel={`Ячейка ${ci + 1}${page.cells[ci]?.photoId ? ', с фото' : ', пустая'}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => setCell({ pageIndex: pi, cellIndex: ci })}
                    style={[styles.hit, { left: r.x, top: r.y, width: r.width, height: r.height }, on && styles.hitOn]}
                  >
                    {!page.cells[ci]?.photoId ? <Text style={styles.plus}>+</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </View>

      <Text style={styles.label}>1. Выберите ячейку, затем фото ниже</Text>
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.id} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }} onPress={() => setTab(t.id)} style={[styles.tab, tab === t.id && styles.tabOn]}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'template' ? (
        <Button
          title="Свободный режим и слои"
          variant="secondary"
          disabled={ordered}
          onPress={() => router.push({ pathname: '/project/[id]/free', params: { id: String(id), spread: String(spread) } })}
        />
      ) : null}
      {tab === 'template' ? (
        <Button
          title="Шаблоны разворота"
          variant="secondary"
          disabled={ordered}
          onPress={() => router.push({ pathname: '/project/[id]/spread-templates', params: { id: String(id), spread: String(spread) } })}
        />
      ) : null}
      {tab === 'gap' ? (
        <Slider
          label="Отступы"
          value={Math.round(gapValue * 100)}
          min={0}
          max={12}
          step={1}
          onChange={(v) => setGapPreview(v / 100)}
          onCommit={(v) => {
            if (!ordered) applyGap(v / 100);
            setGapPreview(null);
          }}
          format={(v) => `${v}%`}
        />
      ) : null}
      {tab === 'bg' ? (
        <View style={styles.row}>
          {BACKGROUNDS.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Фон ${c}`}
              accessibilityState={{ selected: layout.pages[leftIndex]?.bg === c }}
              disabled={ordered}
              onPress={() => {
                let next = layout;
                for (const i of pageIdx) next = setPageBg(next, i, c);
                setLayout(next);
              }}
              style={[styles.swatch, { backgroundColor: c }, layout.pages[leftIndex]?.bg === c && styles.swatchOn]}
            />
          ))}
          <Button
            title="Как в теме"
            variant="secondary"
            disabled={ordered}
            onPress={() => {
              let next = layout;
              for (const i of pageIdx) next = setPageBg(next, i, null);
              setLayout(next);
            }}
          />
        </View>
      ) : null}
      {tab === 'text' ? (
        <View style={styles.row}>
          {TEXT_STYLE_IDS.map((sid) => (
            <Button
              key={sid}
              title={`+ ${TEXT_STYLES[sid].label}`}
              variant="secondary"
              disabled={ordered || (layout.pages[leftIndex]?.texts?.length ?? 0) >= MAX_PAGE_TEXTS}
              onPress={() => setLayout(addPageText(layout, leftIndex, { text: TEXT_STYLES[sid].sample, x: 0.5, y: 0.88, style: sid }))}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.trayHead}>
        <Text style={styles.label}>2. Ваши фотографии</Text>
        <Text style={styles.hint}>{photoList.length} фото</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray}>
        {photoList.map((p) => {
          const on = photoId === p.id;
          const info = sourceOf(p.id);
          return (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`Фото${placed.has(p.id) ? ', уже в макете' : ''}`}
              accessibilityState={{ selected: on }}
              onPress={() => setPhotoId(p.id)}
              style={[styles.thumb, on && styles.thumbOn]}
            >
              {info ? <Image source={info.source} style={styles.thumbImg} resizeMode="cover" /> : null}
              {placed.has(p.id) ? (
                <View style={styles.badge} pointerEvents="none">
                  <Text style={styles.badgeText}>В макете</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" accessibilityLabel="Загрузить фото" onPress={() => router.push(`/project/${id}/photos`)} style={[styles.thumb, styles.upload]}>
          <Text style={styles.plus}>+</Text>
          <Text style={styles.hint}>Загрузить</Text>
        </Pressable>
      </ScrollView>

      <Button title="Разместить фото" disabled={ordered || !cellValid || !photoId} onPress={place} />
      <Text style={styles.hint}>{cellValid && photoId ? 'В выделенную ячейку · выбрано 1 фото' : 'Выберите ячейку и фото'}</Text>
      <Button
        title="Подробная правка страницы"
        variant="secondary"
        disabled={ordered}
        onPress={() => router.dismissTo({ pathname: '/project/[id]/overview', params: { id: String(id), page: String(rightIndex ?? leftIndex) } })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stub: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  scroll: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  label: { ...typography.bodyStrong, color: lightColors.text },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  spreadBox: { flexDirection: 'row', justifyContent: 'center', gap: 2, padding: space[3], backgroundColor: lightColors.surface, borderRadius: radius.photo * 2 },
  hit: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent', borderRadius: 4 },
  hitOn: { borderColor: lightColors.accent, borderStyle: 'dashed', backgroundColor: 'rgba(235,87,87,0.08)' },
  plus: { ...typography.h2, color: lightColors.accent },
  tabs: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
  tab: { minHeight: 44, paddingHorizontal: space[3], borderRadius: radius.button, backgroundColor: lightColors.surface, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: lightColors.accent },
  tabText: { ...typography.bodyStrong, color: lightColors.text },
  tabTextOn: { color: '#FFFFFF' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: lightColors.border },
  swatchOn: { borderColor: lightColors.accent, borderWidth: 2.5 },
  trayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tray: { gap: space[2] },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.photo * 2, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: lightColors.surface },
  thumbOn: { borderColor: lightColors.accent },
  thumbImg: { width: '100%', height: '100%' },
  upload: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', left: 4, right: 4, bottom: 4, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', paddingVertical: 2 },
  badgeText: { ...typography.label, color: lightColors.text },
});
