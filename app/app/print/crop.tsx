import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function PrintCropScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Кадрирование</Text>
      <Text style={styles.sub}>Жесты pinch/drag будут здесь. Пока сохраняем как есть.</Text>
      <Button title="Готово" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3], justifyContent: 'center' },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textMuted },
});
