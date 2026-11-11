import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function AiConsentScreen() {
  const client = useApiClient();

  async function accept() {
    await client.post('/ai/consent', { consent: true });
    router.push('/ai/edit');
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Согласие на AI</Text>
      <Text style={styles.sub}>
        Согласие нужно для AI-правки фото и текстового чата-ассистента. Фото (без GPS/EXIF, с меткой picPac) и ваши сообщения уходят во внешний сервис aiai.by по защищённому HTTPS. Оригинал у нас сохраняется; результат попадёт в заказ только после вашего действия. Согласие можно отозвать в профиле: «Мои данные и безопасность».
      </Text>
      <Button title="Согласен" onPress={() => void accept()} />
      <Button title="Отмена" variant="text" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg, padding: space[4], gap: space[3], justifyContent: 'center' },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
});
