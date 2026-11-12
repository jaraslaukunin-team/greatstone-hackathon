import * as ImagePicker from 'expo-image-picker';
import { convertToJpeg } from './convertToJpeg';

export type PickedPhoto = {
  localId: string;
  uri: string;
};

export async function pickPhotos(options: { selectionLimit?: number } = {}): Promise<PickedPhoto[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Нужен доступ к галерее');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    allowsMultipleSelection: true,
    ...(options.selectionLimit ? { selectionLimit: options.selectionLimit } : {}),
    mediaTypes: ['images'],
    quality: 1,
  });

  if (result.canceled) return [];

  const photos: PickedPhoto[] = [];
  for (const [index, asset] of result.assets.entries()) {
    const uri = await convertToJpeg(asset.uri);
    photos.push({
      localId: asset.assetId ?? `${Date.now()}-${index}`,
      uri,
    });
  }
  return photos;
}
