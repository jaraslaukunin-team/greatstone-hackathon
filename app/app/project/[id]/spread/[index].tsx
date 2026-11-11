import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { applyTemplate, replacePhoto, setCrop, swapCells } from '../../../../src/editor/editorActions';
import { useProjectStore } from '../../../../src/project/projectStore';
import { Button } from '../../../../src/ui/Button';
import { lightColors, space, typography } from '../../../../src/theme/theme';

export default function SpreadEditorScreen() {
  const { id, index } = useLocalSearchParams<{ id: string; index: string }>();
  const pageIndex = Number(index ?? 0);
  const { draft, setLayout } = useProjectStore();
  const page = draft?.layout.pages[pageIndex];

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
      {page.cells.map((cell, cellIndex) => (
        <Text key={cellIndex} style={styles.cell}>
          Ячейка {cellIndex + 1}: {cell.photoId ?? 'пусто'} · scale {cell.crop.scale}
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
      <Button
        title="Заменить фото-заглушкой"
        variant="secondary"
        onPress={() =>
          setLayout(
            replacePhoto(draft.layout, { pageIndex, cellIndex: 0 }, '00000000-0000-4000-8000-000000000999'),
          )
        }
      />
      <Button title="К обзору" onPress={() => router.push(`/project/${id}/overview`)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[2] },
  title: { ...typography.h1, color: lightColors.text, marginTop: space[5] },
  sub: { ...typography.body, color: lightColors.textMuted },
  cell: { ...typography.caption, color: lightColors.text },
});
