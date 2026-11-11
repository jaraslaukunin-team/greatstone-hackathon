import { Stack } from 'expo-router';
import { stackOptions } from '../../src/ui/stackOptions';

export default function AlbumLayout() {
  return <Stack screenOptions={{ ...stackOptions, title: 'Альбом' }} />;
}
