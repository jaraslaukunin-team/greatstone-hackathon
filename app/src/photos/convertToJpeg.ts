import * as ImageManipulator from 'expo-image-manipulator';

export async function convertToJpeg(uri: string): Promise<string> {
  if (/\.jpe?g$/i.test(uri)) return uri;
  const result = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}
