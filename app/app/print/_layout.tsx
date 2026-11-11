import { Stack } from 'expo-router';
import { stackOptions } from '../../src/ui/stackOptions';

export default function PrintLayout() {
  return <Stack screenOptions={{ ...stackOptions, title: 'Печать' }} />;
}
