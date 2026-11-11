import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function PrintFormatScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Параметры печати</Text>
      <Card>
        <Text style={styles.cardTitle}>Бумага: глянцевая</Text>
        <Text style={styles.cardSub}>Без полей</Text>
      </Card>
      <Button
        title="Выбрать фото"
        onPress={() => router.push({ pathname: '/print/frames', params: { productId } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  cardSub: { ...typography.caption, color: lightColors.textMuted, marginTop: 4 },
});
