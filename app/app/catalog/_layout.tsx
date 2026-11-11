import { Stack } from 'expo-router';
import { stackOptions } from '../../src/ui/stackOptions';

export default function CatalogLayout() {
  return <Stack screenOptions={{ ...stackOptions, title: 'Каталог' }} />;
}
