import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { convertToJpeg } from './convertToJpeg';

export type PickedPhoto = {
  localId: string;
  uri: string;
};

export async function pickPhotos(): Promise<PickedPhoto[]> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Нужен доступ к галерее');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    mediaTypes: ['images'],
    quality: 1,
  });

  if (result.canceled) return [];

  const photos: PickedPhoto[] = [];
  for (const [index, asset] of result.assets.entries()) {
    const originalType = asset.file?.type || asset.mimeType;
    const uri = await convertToJpeg(asset.uri, originalType);
    photos.push({
      localId: asset.assetId ?? `${Date.now()}-${index}`,
      uri,
    });
  }
  return photos;
}
