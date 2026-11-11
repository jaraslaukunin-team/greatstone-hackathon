import { Stack } from 'expo-router';
import { stackOptions } from '../../src/ui/stackOptions';

export default function AiLayout() {
  return <Stack screenOptions={{ ...stackOptions, title: 'AI' }} />;
}
