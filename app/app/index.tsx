import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../src/auth/AuthProvider';
import { lightColors } from '../src/theme/theme';

export default function Index() {
  const { token, ready } = useAuth();
  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={lightColors.accent} size="large" />
      </View>
    );
  }
  return <Redirect href={token ? '/(tabs)' : '/(auth)/welcome'} />;
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.bg,
  },
});
