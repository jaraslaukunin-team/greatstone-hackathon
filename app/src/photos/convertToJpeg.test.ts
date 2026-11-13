import { manipulateAsync } from 'expo-image-manipulator';
import { convertToJpeg } from './convertToJpeg';

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'converted.jpg' }),
  SaveFormat: { JPEG: 'jpeg' },
}));

it.each([
  ['blob:http://localhost/photo', 'image/jpeg'],
  ['data:image/jpeg;base64,ABC', undefined],
  ['file:///photo.JPG?size=original', undefined],
])('keeps original JPEG bytes for %s', async (uri, mime) => {
  jest.clearAllMocks();
  await expect(convertToJpeg(uri, mime)).resolves.toBe(uri);
  expect(manipulateAsync).not.toHaveBeenCalled();
});

it('converts non-JPEG photos', async () => {
  await expect(convertToJpeg('blob:http://localhost/photo', 'image/png')).resolves.toBe('converted.jpg');
});
