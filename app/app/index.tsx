import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../src/auth/AuthProvider';
import { homeFor } from '../src/auth/roleMode';
import { useRoleMode } from '../src/auth/roleStore';
import { lightColors } from '../src/theme/theme';

export default function Index() {
  const { token, user, ready } = useAuth();
  const mode = useRoleMode((s) => s.mode);
  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={lightColors.accent} size="large" />
      </View>
    );
  }
  return <Redirect href={token ? homeFor(mode, user ?? { role: 'customer' }) : '/(auth)/welcome'} />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.bg,
  },
});
