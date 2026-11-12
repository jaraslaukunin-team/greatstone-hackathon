import { Stack } from 'expo-router';
import { stackOptions } from '../../src/ui/stackOptions';
import { useT } from '../../src/i18n/useT';

export default function ProfileStackLayout() {
  const t = useT();
  return (
    <Stack screenOptions={{ ...stackOptions, title: t.profile.title }}>
      <Stack.Screen name="data" options={{ title: t.profile.data }} />
      <Stack.Screen name="addresses" options={{ title: t.profile.addresses }} />
      <Stack.Screen name="support" options={{ title: t.profile.support }} />
      <Stack.Screen name="faq" options={{ title: t.profile.faq }} />
      <Stack.Screen name="about" options={{ title: t.profile.about }} />
    </Stack>
  );
}
