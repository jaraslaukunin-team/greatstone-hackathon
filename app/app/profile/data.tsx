import type { DataSummaryDTO } from '@picpac/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { tr } from '../../src/i18n/runtimeTranslate';
import { useSettingsStore } from '../../src/settings/settingsStore';
import { Button } from '../../src/ui/Button';
import { Card } from '../../src/ui/Card';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function ProfileDataScreen() {
  const client = useApiClient();
  const { logout } = useAuth();
  const lang = useSettingsStore((s) => s.lang);
  const [summary, setSummary] = useState<DataSummaryDTO | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    void client
      .get<DataSummaryDTO>('/me/data-summary')
      .then(setSummary)
      .catch(() => setError('Не удалось загрузить сводку'));
  }
  useEffect(load, [client]);

  async function revokeAi() {
    setError(null);
    try {
      await client.delete('/ai/consent');
      setMessage('Согласие на AI отозвано. Фото больше не отправляются на обработку.');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отозвать согласие');
    }
  }

  async function onDelete() {
    setError(null);
    try {
      await client.delete('/me/data');
      await logout();
      router.replace('/(auth)/welcome');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить данные');
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Мои данные и безопасность</Text>

      <Card>
        <Text style={styles.h2}>Что у нас хранится</Text>
        <Text style={styles.row}>Проекты: {summary ? summary.projects : '…'}</Text>
        <Text style={styles.row}>Загруженные фото: {summary ? summary.photos : '…'}</Text>
        <Text style={styles.row}>Заказы: {summary ? summary.orders : '…'}</Text>
        <Text style={styles.row}>
          Согласие на AI:{' '}
          {summary
            ? summary.aiConsentAt
              ? `${tr('дано')} ${new Date(summary.aiConsentAt).toLocaleDateString(lang === 'be' ? 'be-BY' : 'ru-RU')}`
              : tr('не давалось')
            : '…'}
        </Text>
      </Card>

      <Card>
        <Text style={styles.h2}>Как мы это защищаем</Text>
        <Text style={styles.body}>Ваши проекты и заказы видите только вы. Чужие данные сервер не отдаёт, даже если знать адрес.</Text>
        <Text style={styles.body}>Ссылки на фото действуют один час. Коды входа и пароли альбомов хранятся только в виде хешей.</Text>
        <Text style={styles.body}>
          После согласия фото (очищенные от EXIF/GPS, с меткой picPac) и сообщения чата уходят в aiai.by по HTTPS только для запросов, которые вы сами запускаете. На диске сервера файлы можно хранить в зашифрованном виде.
        </Text>
        <Text style={styles.body}>Сотрудники «Фотопринт» видят только заказы и пишут в журнал каждое своё действие.</Text>
      </Card>

      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {summary?.aiConsentAt ? (
        <Button title="Отозвать согласие на AI" variant="secondary" onPress={() => void revokeAi()} />
      ) : null}

      {confirming ? (
        <Card tone="rose">
          <Text style={styles.h2}>Удалить всё без возврата?</Text>
          <Text style={styles.body}>
            Удалим проекты, фото и AI-задачи. Заказы в истории останутся без привязки к вам. Отменить это нельзя.
          </Text>
          <Button title="Да, удалить все мои данные" onPress={() => void onDelete()} />
          <Button title="Нет, оставить" variant="text" onPress={() => setConfirming(false)} />
        </Card>
      ) : (
        <Button title="Удалить все мои данные" variant="secondary" onPress={() => setConfirming(true)} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3] },
  title: { ...typography.h1, color: lightColors.text },
  h2: { ...typography.h2, color: lightColors.text, marginBottom: space[2] },
  row: { ...typography.body, color: lightColors.text, marginTop: 2 },
  body: { ...typography.body, color: lightColors.textSecondary, marginTop: space[1] },
  ok: { ...typography.body, color: lightColors.success },
  error: { ...typography.caption, color: lightColors.danger },
});
