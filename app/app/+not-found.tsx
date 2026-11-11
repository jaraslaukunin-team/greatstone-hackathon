import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../src/ui/Button';
import { lightColors, space, typography } from '../src/theme/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Страница не найдена' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Такой страницы нет</Text>
        <Text style={styles.sub}>Возможно, ссылка устарела. Вернитесь на главный экран.</Text>
        <Link href="/" asChild>
          <Button title="На главную" />
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: space[4],
    gap: space[3],
    backgroundColor: lightColors.bg,
  },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary, marginBottom: space[3] },
});
