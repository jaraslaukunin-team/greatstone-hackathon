import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { homeFor } from '../../src/auth/roleMode';
import { useRoleMode } from '../../src/auth/roleStore';

export default function AuthLayout() {
  const { token, user, ready } = useAuth();
  const mode = useRoleMode((s) => s.mode);
  if (!ready) return null;
  if (token) return <Redirect href={homeFor(mode, user ?? { role: 'customer' })} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="role" />
      <Stack.Screen name="login" />
      <Stack.Screen name="code" />
    </Stack>
  );
}
