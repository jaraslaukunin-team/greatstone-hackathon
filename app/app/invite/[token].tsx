import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { savePendingInvite } from '../../src/album/pendingInvite';
import { useAuth } from '../../src/auth/AuthProvider';
import { lightColors } from '../../src/theme/theme';

/**
 * Ссылка-приглашение с сайта: /invite/<токен>. Вошедшего ведём на приём приглашения,
 * невошедшему запоминаем токен: после входа приглашение откроется само.
 */
export default function InviteLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { token: session, ready } = useAuth();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!ready || session || !token) return;
    void savePendingInvite(String(token)).then(() => setSaved(true));
  }, [ready, session, token]);

  if (!ready || (!session && !saved && token)) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={lightColors.accent} size="large" />
      </View>
    );
  }
  if (!token) return <Redirect href="/" />;
  if (session) return <Redirect href={{ pathname: '/album/invite', params: { token: String(token) } }} />;
  return <Redirect href="/(auth)/welcome" />;
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: lightColors.bg },
});
