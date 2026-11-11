import { Stack } from 'expo-router';
import { stackOptions } from '../../src/ui/stackOptions';

export default function ProfileStackLayout() {
  return <Stack screenOptions={{ ...stackOptions, title: 'Профиль' }} />;
}
