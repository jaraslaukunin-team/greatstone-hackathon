import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';

export default function OperatorLayout() {
  const { user } = useAuth();
  if (user && user.role !== 'operator') return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: true, title: 'Оператор' }} />;
}
