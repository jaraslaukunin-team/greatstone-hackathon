import { tr } from '../../src/i18n/runtimeTranslate';
import { Stack } from 'expo-router';
import { stackOptions } from '../../src/ui/stackOptions';

export default function CatalogLayout() {
  return <Stack screenOptions={{ ...stackOptions, title: tr('Каталог') }} />;
}
