import type { PhotoDTO } from '@picpac/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../../../src/api/hooks';
import { applyTemplate, replacePhoto, setCrop, swapCells } from '../../../../src/editor/editorActions';
import { useProjectStore } from '../../../../src/project/projectStore';
import { Button } from '../../../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../../../src/theme/theme';

export default function SpreadEditorScreen() {
  const { id, index } = useLocalSearchParams<{ id: string; index: string }>();
  const pageIndex = Number(index ?? 0);
  const { draft, setLayout } = useProjectStore();
  const page = draft?.layout.pages[pageIndex];
  const client = useApiClient();
  const [photos, setPhotos] = useState<PhotoDTO[]>([]);
  const [cellIndex, setCellIndex] = useState(0);

  useEffect(() => {
    void client.get<PhotoDTO[]>(`/projects/${id}/photos`).then(setPhotos).catch(() => undefined);
  }, [client, id]);

  if (!draft || !page) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Разворот не найден</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Редактор разворота {pageIndex + 1}</Text>
      <Text style={styles.sub}>Шаблон: {page.template}</Text>
      {page.cells.map((cell, index) => (
        <Text key={index} style={styles.cell}>
          Ячейка {index + 1}: {cell.photoId ? 'фото выбрано' : 'пусто'} · масштаб {cell.crop.scale.toFixed(1)}
        </Text>
      ))}
      <Button
        title="Шаблон 4 фото"
        variant="secondary"
        onPress={() => setLayout(applyTemplate(draft.layout, pageIndex, 'four'))}
      />
      <Button
        title="Увеличить кадр"
        variant="secondary"
        onPress={() =>
          setLayout(
            setCrop(draft.layout, { pageIndex, cellIndex: 0 }, {
              ...page.cells[0]!.crop,
              scale: page.cells[0]!.crop.scale + 0.2,
            }),
          )
        }
      />
      <Button
        title="Поменять с следующим"
        variant="secondary"
        onPress={() =>
          setLayout(
            swapCells(
              draft.layout,
              { pageIndex, cellIndex: 0 },
              { pageIndex: Math.min(pageIndex + 1, draft.layout.pages.length - 1), cellIndex: 0 },
            ),
          )
        }
      />
      <Text style={styles.sub}>
        Заменить фото{page.cells.length > 1 ? ` в ячейке ${cellIndex + 1}` : ''}:
      </Text>
      {page.cells.length > 1 ? (
        <View style={styles.chips}>
          {page.cells.map((_, i) => (
            <Button
              key={i}
              title={`Ячейка ${i + 1}`}
              variant={i === cellIndex ? 'primary' : 'secondary'}
              onPress={() => setCellIndex(i)}
            />
          ))}
        </View>
      ) : null}
      <ScrollView horizontal contentContainerStyle={styles.strip}>
        {photos.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel="Поставить это фото"
            onPress={() => setLayout(replacePhoto(draft.layout, { pageIndex, cellIndex }, p.id))}
          >
            <Image
              source={{ uri: client.resolveUrl(p.url) }}
              style={[styles.stripThumb, page.cells[cellIndex]?.photoId === p.id && styles.stripThumbActive]}
            />
          </Pressable>
        ))}
      </ScrollView>
      <Button title="К обзору" onPress={() => router.push(`/project/${id}/overview`)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[2] },
  title: { ...typography.h1, color: lightColors.text, marginTop: space[5] },
  sub: { ...typography.body, color: lightColors.textSecondary },
  cell: { ...typography.caption, color: lightColors.text },
  chips: { flexDirection: 'row', gap: space[2] },
  strip: { gap: space[2] },
  stripThumb: { width: 64, height: 64, borderRadius: radius.photo, backgroundColor: lightColors.border },
  stripThumbActive: { borderWidth: 2, borderColor: lightColors.accent },
});
