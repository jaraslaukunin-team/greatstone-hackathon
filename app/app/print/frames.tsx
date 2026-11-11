import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function PrintFramesScreen() {
  const [copies, setCopies] = useState([1, 1, 1]);
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Ваши отпечатки</Text>
      {copies.map((value, index) => (
        <Card key={index}>
          <Text style={styles.cardTitle}>Кадр {index + 1}</Text>
          <View style={styles.row}>
            <Button title="−" variant="secondary" onPress={() => setCopies((c) => c.map((v, i) => (i === index ? Math.max(1, v - 1) : v)))} />
            <Text style={styles.count}>{value}</Text>
            <Button title="+" variant="secondary" onPress={() => setCopies((c) => c.map((v, i) => (i === index ? v + 1 : v)))} />
            <Button title="Кадр" variant="text" onPress={() => router.push('/print/crop')} />
          </View>
        </Card>
      ))}
      <Button title="В корзину" onPress={() => router.push('/(tabs)/cart')} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  cardTitle: { ...typography.bodyStrong, color: lightColors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginTop: space[2] },
  count: { ...typography.bodyStrong, color: lightColors.text, minWidth: 24, textAlign: 'center' },
});
