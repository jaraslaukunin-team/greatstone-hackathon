import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useApiClient } from '../../src/api/hooks';
import { useAuth } from '../../src/auth/AuthProvider';
import { useT } from '../../src/i18n/useT';
import { useSettingsStore } from '../../src/settings/settingsStore';
import { Button } from '../../src/ui/Button';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const client = useApiClient();
  const t = useT();
  const { lang, notifications, setLang, setNotifications } = useSettingsStore();
  const demoHint = process.env.EXPO_PUBLIC_DEMO_HINT === '1';
  const [message, setMessage] = useState<string | null>(null);

  async function deleteData() {
    setMessage(null);
    try {
      await client.delete('/me/data');
      await logout();
      router.replace('/(auth)/welcome');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Не удалось удалить данные');
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.profile.title}</Text>
      <Text style={styles.sub}>{user?.displayName ?? 'Гость'}</Text>

      <Button
        title={t.profile.data}
        icon="lock"
        variant="secondary"
        onPress={() => router.push('/profile/data')}
      />
      <Button
        title={t.profile.addresses}
        icon="pin"
        variant="secondary"
        onPress={() => router.push('/profile/addresses')}
      />

      {/* Notifications toggle */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t.profile.notifications}</Text>
        <Switch
          value={notifications}
          onValueChange={(v) => setNotifications(v)}
          trackColor={{ true: lightColors.accent, false: lightColors.disabledBg }}
          thumbColor={lightColors.surface}
        />
      </View>

      {/* Language toggle */}
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{t.profile.language}</Text>
        <View style={styles.langRow}>
          <Text
            style={[styles.langOption, lang === 'ru' && styles.langActive]}
            onPress={() => setLang('ru')}
            accessibilityRole="button"
          >
            {t.profile.langRu}
          </Text>
          <Text style={styles.langSep}>/</Text>
          <Text
            style={[styles.langOption, lang === 'be' && styles.langActive]}
            onPress={() => setLang('be')}
            accessibilityRole="button"
          >
            {t.profile.langBe}
          </Text>
        </View>
      </View>

      <Button
        title={t.profile.support}
        icon="info"
        variant="secondary"
        onPress={() => router.push('/profile/support')}
      />
      <Button
        title={t.profile.faq}
        icon="search"
        variant="secondary"
        onPress={() => router.push('/profile/faq')}
      />
      <Button
        title={t.profile.about}
        icon="alert"
        variant="secondary"
        onPress={() => router.push('/profile/about')}
      />

      <Button
        title={t.profile.deleteData}
        icon="trash"
        variant="secondary"
        onPress={() => void deleteData()}
      />
      <Button
        title={t.profile.logout}
        variant="text"
        onPress={() => {
          void logout().then(() => router.replace('/(auth)/welcome'));
        }}
      />

      {message ? <Text style={styles.error}>{message}</Text> : null}

      {demoHint ? (
        <Text style={styles.meta}>
          {t.profile.apiLabel} {process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], paddingTop: space[7], gap: space[3], paddingBottom: space[7] },
  title: { ...typography.h1, color: lightColors.text },
  sub: { ...typography.body, color: lightColors.textSecondary },
  meta: { ...typography.caption, color: lightColors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    backgroundColor: lightColors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: lightColors.borderStrong,
    paddingHorizontal: 20,
  },
  rowLabel: { ...typography.body, color: lightColors.text },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  langOption: { ...typography.body, color: lightColors.textSecondary, minHeight: 44, textAlignVertical: 'center', paddingVertical: 10 },
  langActive: { ...typography.bodyStrong, color: lightColors.accent },
  langSep: { ...typography.body, color: lightColors.textMuted },
  error: { ...typography.caption, color: lightColors.danger },
});
