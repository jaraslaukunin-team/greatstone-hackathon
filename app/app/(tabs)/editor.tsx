import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useProjectStore } from '../../src/project/projectStore';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function EditorTabScreen() {
  const draft = useProjectStore((s) => s.draft);
  const projectId = draft?.project.id;

  function openEditor() {
    const requestId = `edit-${Date.now()}`;
    router.push({
      pathname: '/photo-editor',
      params: projectId ? { projectId, requestId } : { requestId },
    });
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Редактор</Text>
      <Text style={styles.sub}>
        Кадрирование, фильтры и текст — в фоторедакторе. Генерация фона и сцен — через нейросеть.
      </Text>

      <Button title="Открыть редактор" onPress={openEditor} />
      <Button
        title="Сгенерировать нейросетью"
        variant="secondary"
        onPress={() => router.push('/ai/consent')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: lightColors.bg,
    paddingTop: space[7],
    paddingHorizontal: space[4],
    gap: space[3],
  },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
});
