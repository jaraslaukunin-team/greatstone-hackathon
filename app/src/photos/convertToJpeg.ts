import * as ImageManipulator from 'expo-image-manipulator';

export async function convertToJpeg(uri: string, mimeType?: string): Promise<string> {
  if (mimeType?.toLowerCase() === 'image/jpeg' || /^data:image\/jpeg[;,]/i.test(uri) || /\.jpe?g(?:[?#]|$)/i.test(uri)) return uri;
  const result = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return result.uri;
}
