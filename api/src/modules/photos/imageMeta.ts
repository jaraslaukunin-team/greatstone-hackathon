import exifr from 'exifr';
import { imageSize } from 'image-size';
import { AppError } from '../../errors.js';

export type ImageMeta = {
  mime: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
  takenAt: Date | null;
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function sniffMime(buf: Buffer): ImageMeta['mime'] | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  return null;
}

const unsupported = () =>
  new AppError(415, 'FORMAT_UNSUPPORTED', 'Подходят только файлы JPEG и PNG. Этот файл не открывается или повреждён');

// EXIF хранит время съёмки без часового пояса: читаем строку как есть и считаем её UTC,
// чтобы результат не зависел от настроек машины.
function parseExifDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number) as [number, number, number, number, number, number];
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  return Number.isNaN(date.getTime()) ? null : date;
}

// Размеры берутся с учётом EXIF-ориентации: у ориентаций 5-8 снимок повёрнут на 90°,
// поэтому ширина и высота меняются местами (вертикальные кадры с телефона).
export async function readImageMeta(buf: Buffer): Promise<ImageMeta> {
  const mime = sniffMime(buf);
  if (!mime) throw unsupported();
  let width: number | undefined;
  let height: number | undefined;
  try {
    ({ width, height } = imageSize(buf));
  } catch {
    throw unsupported();
  }
  if (!width || !height) throw unsupported();

  let takenAt: Date | null = null;
  if (mime === 'image/jpeg') {
    try {
      const exif = (await exifr.parse(buf, {
        pick: ['Orientation', 'DateTimeOriginal'],
        translateValues: false,
        reviveValues: false,
      })) as { Orientation?: number; DateTimeOriginal?: unknown } | undefined;
      if (exif?.Orientation && exif.Orientation >= 5 && exif.Orientation <= 8) [width, height] = [height, width];
      takenAt = parseExifDate(exif?.DateTimeOriginal);
    } catch {
      // Нечитаемый EXIF не делает фото непригодным: берём размеры как есть.
    }
  }
  return { mime, width, height, takenAt };
}
