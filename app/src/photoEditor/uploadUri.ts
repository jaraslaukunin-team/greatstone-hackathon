import { Platform } from 'react-native';
import { bytesToBase64 } from './base64';

/**
 * Адрес, который умеет читать client.upload: в браузере blob:, на телефоне временный файл в кэше.
 * (client.upload читает blob: через fetch, а на телефоне отправляет файл по file://.)
 */
export async function bytesToUploadUri(bytes: Uint8Array, name = 'edited.jpg'): Promise<string> {
  if (Platform.OS === 'web') {
    return URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: 'image/jpeg' }));
  }
  const FileSystem = await import('expo-file-system/legacy');
  const uri = `${FileSystem.cacheDirectory}${Date.now()}-${name}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}
