import type { ProjectDTO } from '@picpac/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useCatalog } from '../../src/catalog/useCatalog';
import { Button } from '../../src/ui/Button';
import { Input } from '../../src/ui/Input';
import { lightColors, space, typography } from '../../src/theme/theme';

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
      <Input value={title} onChangeText={setTitle} />
      <Input
       
        value={expected}
        onChangeText={setExpected}
        keyboardType="number-pad"
        placeholder="Число учеников"
      />
      <Button title="Создать" onPress={() => void create()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
});
