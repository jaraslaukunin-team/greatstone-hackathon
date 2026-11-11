import { Stack } from 'expo-router';
import { stackOptions } from '../../src/ui/stackOptions';

export default function ProjectLayout() {
  return <Stack screenOptions={{ ...stackOptions }} />;
}
