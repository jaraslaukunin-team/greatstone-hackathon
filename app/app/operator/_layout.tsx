import { tr } from '../../src/i18n/runtimeTranslate';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { stackOptions } from '../../src/ui/stackOptions';

export default function OperatorLayout() {
  const { user } = useAuth();
  if (user && user.role !== 'operator') return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ ...stackOptions, title: tr('Оператор') }} />;
}
