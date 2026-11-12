import { AddProjectPhotos } from '../../../src/photos/AddProjectPhotos';
import { themeById, type Layout } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useApiClient } from '../../../src/api/hooks';
import { FreeCanvas } from '../../../src/book/FreeCanvas';
import { spreadsOf } from '../../../src/book/flip';
import {
  addPhotoLayer,
  addTextLayer,
  enableFree,
  listLayers,
  removeLayer,
  reorder,
  resizeKeepAspect,
  rotateBy,
  toggleHidden,
  toggleLocked,
  type LayerRef,
} from '../../../src/book/layers';
import { LayersPanel } from '../../../src/book/LayersPanel';
import { spreadRange } from '../../../src/book/spreadInfo';
import { TEXT_STYLES, TEXT_STYLE_IDS } from '../../../src/book/textStyles';
import { setPageBg } from '../../../src/editor/editorActions';
import { useDebouncedSync } from '../../../src/project/useDebouncedSync';
import { useProjectStore } from '../../../src/project/projectStore';
import { useProjectPhotos } from '../../../src/project/useProjectPhotos';
import { Button } from '../../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../../src/theme/theme';

type Panel = 'none' | 'photos' | 'text' | 'bg' | 'layers';
const BACKGROUNDS = [lightColors.surface, lightColors.fillRose, lightColors.fillSand, lightColors.fillMint, lightColors.fillSky, lightColors.fillLilac];

export default function FreeScreen() {
  const { id, spread: spreadParam } = useLocalSearchParams<{ id: string; spread?: string }>();
  const client = useApiClient();
  const { width: winW } = useWindowDimensions();
  const draft = useProjectStore((s) => s.draft);
  const setLayout = useProjectStore((s) => s.setLayout);
  const { photoList, photoMap, sourceOf, addPhoto } = useProjectPhotos(client, id);
  useDebouncedSync(client, id, !!draft && draft.project.id === id);
  const [selected, setSelected] = useState<LayerRef | null>(null);
  const [panel, setPanel] = useState<Panel>('none');

  const layout = draft && draft.project.id === id ? draft.layout : null;
  const ordered = draft?.project.status === 'ordered';
  const pageCount = layout?.pages.length ?? 0;
  const spreads = spreadsOf(pageCount);
  const spread = Math.min(Math.max(1, Number(spreadParam) || 1), Math.max(1, spreads.length - 1));
  const [leftIndex, rightIndex] = spreads[spread] ?? [null, null];
  const pageIdx = useMemo(() => [leftIndex, rightIndex].filter((i): i is number => i !== null), [leftIndex, rightIndex]);
  const theme = themeById(layout?.themeId);
  const pageWidthCm = 20;

  // При входе все ячейки разворота получают рамки: вид не меняется, но их можно двигать.
  useEffect(() => {
    if (!layout || ordered || pageIdx.length === 0) return;
    const needs = pageIdx.some((i) => layout.pages[i]?.cells.some((c) => !c.frame));
    if (!needs) return;
    let next: Layout = layout;
    for (const i of pageIdx) next = enableFree(next, i, theme, { width: 1000, height: 1000 });
    setLayout(next);
  }, [layout, ordered, pageIdx, theme, setLayout]);

  if (!layout || spreads.length < 2 || leftIndex === null) {
    return (
      <View style={styles.stub}>
        <Text style={styles.sub}>Откройте книгу, затем выберите разворот для правки.</Text>
        <Button title="К книге" onPress={() => router.dismissTo(`/project/${id}/overview`)} />
      </View>
    );
  }

  const pageW = Math.min(190, (winW - space[4] * 2) / 2);
  const photoName = (photoId: string) => `Фото ${photoList.findIndex((p) => p.id === photoId) + 1}`;
  const layers = listLayers(layout, pageIdx, photoName);
  const page = selected ? layout.pages[selected.pageIndex] : undefined;
  const sel = selected
    ? selected.kind === 'cell'
      ? page?.cells[selected.index]
      : page?.texts?.[selected.index]
    : undefined;
  const selFrame = selected?.kind === 'cell' ? page?.cells[selected.index]?.frame : undefined;
  const selName = selected ? (layers.find((l) => l.ref.kind === selected.kind && l.ref.pageIndex === selected.pageIndex && l.ref.index === selected.index)?.name ?? '') : '';
  const locked = Boolean(sel && 'locked' in sel && sel.locked);
  const apply = (next: Layout) => {
    if (!ordered) setLayout(next);
  };
  const rot = selFrame ? selFrame.rot : ((sel && 'rot' in sel ? sel.rot : 0) ?? 0);
  const targetPage = selected?.pageIndex ?? leftIndex;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Свободный режим</Text>
      <Text style={styles.sub}>Разворот {spreadRange(spread, pageCount)} · {layers.length} объектов</Text>
      {ordered ? <Text style={styles.sub}>Проект уже заказан, редактирование недоступно.</Text> : null}

      <View style={styles.stage}>
        <FreeCanvas
          layout={layout}
          pageIndexes={pageIdx}
          selected={selected}
          onSelect={setSelected}
          onChange={apply}
          sourceOf={sourceOf}
          theme={theme}
          pageW={pageW}
          pageWidthCm={pageWidthCm}
          disabled={ordered}
        />
      </View>
      <Text style={styles.hint}>Двигайте объект · меняйте размер за угол · пунктир — безопасная область печати</Text>

      <View style={styles.tools}>
        <Button title="+ Фото" variant="secondary" style={styles.tool} disabled={ordered} onPress={() => setPanel(panel === 'photos' ? 'none' : 'photos')} />
        <Button title="+ Текст" variant="secondary" style={styles.tool} disabled={ordered} onPress={() => setPanel(panel === 'text' ? 'none' : 'text')} />
        <Button title="Фон" variant="secondary" style={styles.tool} disabled={ordered} onPress={() => setPanel(panel === 'bg' ? 'none' : 'bg')} />
        <Button title={`Слои · ${layers.length}`} style={styles.tool} onPress={() => setPanel(panel === 'layers' ? 'none' : 'layers')} />
      </View>

      {panel === 'photos' ? (
        <>
        {!ordered && id ? <AddProjectPhotos projectId={id} existingPhotos={photoList} onAdded={addPhoto} /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray}>
          {photoList.map((p) => {
            const info = sourceOf(p.id);
            return (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`Добавить ${photoName(p.id)}`}
                onPress={() => {
                  const r = addPhotoLayer(layout, targetPage, p.id, (photoMap.get(p.id)?.width ?? 1) / (photoMap.get(p.id)?.height ?? 1));
                  apply(r.layout);
                  if (r.ref) setSelected(r.ref);
                  setPanel('none');
                }}
                style={styles.thumb}
              >
                {info ? <Image source={info.source} style={styles.thumbImg} resizeMode="cover" /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        </>
      ) : null}
      {panel === 'text' ? (
        <View style={styles.chips}>
          {TEXT_STYLE_IDS.map((sid) => (
            <Button
              key={sid}
              title={`+ ${TEXT_STYLES[sid].label}`}
              variant="secondary"
              onPress={() => {
                const r = addTextLayer(layout, targetPage, sid, TEXT_STYLES[sid].sample);
                apply(r.layout);
                if (r.ref) setSelected(r.ref);
                setPanel('none');
              }}
            />
          ))}
        </View>
      ) : null}
      {panel === 'bg' ? (
        <View style={styles.chips}>
          {BACKGROUNDS.map((c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Фон ${c}`}
              onPress={() => {
                let next = layout;
                for (const i of pageIdx) next = setPageBg(next, i, c);
                apply(next);
              }}
              style={[styles.swatch, { backgroundColor: c }]}
            />
          ))}
          <Button
            title="Как в теме"
            variant="secondary"
            onPress={() => {
              let next = layout;
              for (const i of pageIdx) next = setPageBg(next, i, null);
              apply(next);
            }}
          />
        </View>
      ) : null}
      {panel === 'layers' ? (
        <LayersPanel
          layers={layers}
          selected={selected}
          sourceOf={sourceOf}
          disabled={ordered}
          onSelect={setSelected}
          onMove={(ref, to) => {
            const r = reorder(layout, ref, to);
            apply(r.layout);
            setSelected(r.ref);
          }}
          onToggleHidden={(ref) => apply(toggleHidden(layout, ref))}
          onToggleLocked={(ref) => apply(toggleLocked(layout, ref))}
          onRemove={(ref) => {
            apply(removeLayer(layout, ref));
            setSelected(null);
          }}
          onClose={() => setPanel('none')}
        />
      ) : null}

      {selected && sel ? (
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Text style={styles.label}>Выбрано: {selName}</Text>
            {selected.kind === 'cell' ? (
              <Pressable accessibilityRole="button" onPress={() => router.dismissTo({ pathname: '/project/[id]/overview', params: { id: String(id), page: String(selected.pageIndex) } })}>
                <Text style={styles.link}>Кадрировать</Text>
              </Pressable>
            ) : null}
          </View>
          {locked ? <Text style={styles.hint}>Слой закреплён: откройте «Слои» и нажмите «Открепить».</Text> : null}
          <View style={styles.pair}>
            {selFrame ? (
              <View style={styles.stepper}>
                <Text style={styles.hint}>Размер</Text>
                <View style={styles.stepRow}>
                  <Button title="−" variant="secondary" style={styles.step} disabled={ordered || locked} onPress={() => selected && apply(resizeKeepAspect(layout, selected, 0.9))} />
                  <Text style={styles.value}>
                    {(selFrame.w * pageWidthCm).toFixed(1)} × {(selFrame.h * pageWidthCm).toFixed(1)}
                  </Text>
                  <Button title="+" variant="secondary" style={styles.step} disabled={ordered || locked} onPress={() => selected && apply(resizeKeepAspect(layout, selected, 1.1))} />
                </View>
              </View>
            ) : null}
            <View style={styles.stepper}>
              <Text style={styles.hint}>Поворот</Text>
              <View style={styles.stepRow}>
                <Button title="−" variant="secondary" style={styles.step} disabled={ordered || locked} onPress={() => selected && apply(rotateBy(layout, selected, -5))} />
                <Text style={styles.value}>{Math.round(rot)}°</Text>
                <Button title="+" variant="secondary" style={styles.step} disabled={ordered || locked} onPress={() => selected && apply(rotateBy(layout, selected, 5))} />
              </View>
            </View>
          </View>
          <View style={styles.pair}>
            <Button
              title="На слой вперёд"
              variant="secondary"
              style={styles.half}
              disabled={ordered || locked}
              onPress={() => {
                const r = reorder(layout, selected, 'forward');
                apply(r.layout);
                setSelected(r.ref);
              }}
            />
            <Button
              title="На слой назад"
              variant="secondary"
              style={styles.half}
              disabled={ordered || locked}
              onPress={() => {
                const r = reorder(layout, selected, 'backward');
                apply(r.layout);
                setSelected(r.ref);
              }}
            />
          </View>
        </View>
      ) : null}

      <Button title="Сохранить разворот" disabled={ordered} onPress={() => router.back()} />
      <Text style={styles.hint}>Правки сохраняются автоматически · изменения только на страницах {spreadRange(spread, pageCount)}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stub: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  scroll: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  label: { ...typography.bodyStrong, color: lightColors.text },
  link: { ...typography.bodyStrong, color: lightColors.accent },
  stage: { alignItems: 'center', padding: space[3], backgroundColor: lightColors.surface, borderRadius: radius.photo * 2 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  tool: { flexGrow: 1 },
  tray: { gap: space[2] },
  thumb: { width: 72, height: 72, borderRadius: radius.photo * 2, overflow: 'hidden', backgroundColor: lightColors.surface },
  thumbImg: { width: '100%', height: '100%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: lightColors.border },
  sheet: { gap: space[2], backgroundColor: lightColors.surface, borderRadius: radius.photo * 2, padding: space[3] },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pair: { flexDirection: 'row', gap: space[2] },
  stepper: { flex: 1, gap: 4 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: space[1], justifyContent: 'space-between' },
  step: { minWidth: 44 },
  value: { ...typography.bodyStrong, color: lightColors.text, textAlign: 'center', flexShrink: 1 },
  half: { flex: 1 },
});
