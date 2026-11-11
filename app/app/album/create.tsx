import type { ProjectDTO } from '@picpac/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useCatalog } from '../../src/catalog/useCatalog';
import { Button } from '../../src/ui/Button';
import { lightColors, radius, space, typography } from '../../src/theme/theme';

export default function CreateAlbumScreen() {
  const client = useApiClient();
  const catalog = useCatalog();
  const [title, setTitle] = useState('11 Б, 2027');
  const [expected, setExpected] = useState('25');
  const graduation = catalog.data?.products.find((p) => p.kind === 'graduation');
  const variantId = graduation?.variants[0]?.id;

  async function create() {
    if (!variantId) return;
    const project = await client.post<ProjectDTO>('/projects', {
      variantId,
      title,
      isShared: true,
      expectedMembers: Number(expected) || 1,
    });
    router.push(`/album/${project.id}`);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Выпускной альбом</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} />
      <TextInput
        style={styles.input}
        value={expected}
        onChangeText={setExpected}
        keyboardType="number-pad"
        placeholder="Число учеников"
        placeholderTextColor={lightColors.textMuted}
      />
      <Button title="Создать" onPress={() => void create()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  input: {
    backgroundColor: lightColors.surfaceMuted,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: space[3],
    color: lightColors.text,
  },
});
