import { createHash } from 'node:crypto';
import sharp from 'sharp';

export type AiEgressPayload = {
  /** JPEG без EXIF/GPS, с водяным знаком picPac (копия только для отправки). */
  image: Buffer;
  mime: 'image/jpeg';
  /** SHA-256 исходного буфера до обработки. */
  sha256: string;
};

/**
 * Готовит копию фото для внешнего AI: отпечаток исходника, сброс EXIF (через rotate+re-encode),
 * лёгкий водяной знак в углу. Оригинал на диске не меняется.
 */
export async function prepareAiEgress(source: Buffer): Promise<AiEgressPayload> {
  const sha256 = createHash('sha256').update(source).digest('hex');
  const base = sharp(source).rotate();
  const meta = await base.metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;
  const fontSize = Math.max(12, Math.round(Math.min(width, height) * 0.028));
  const pad = Math.max(8, Math.round(fontSize * 0.4));
  const label = 'picPac';
  const textWidth = Math.ceil(label.length * fontSize * 0.62);
  const boxW = textWidth + pad * 2;
  const boxH = fontSize + pad * 2;
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect x="${width - boxW - pad}" y="${height - boxH - pad}" width="${boxW}" height="${boxH}" ` +
      `rx="4" fill="black" fill-opacity="0.35"/>` +
      `<text x="${width - pad * 2}" y="${height - pad * 2 - fontSize * 0.2}" ` +
      `text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" ` +
      `fill="white" fill-opacity="0.85">${label}</text>` +
      `</svg>`,
  );
  const image = await sharp(source)
    .rotate()
    .composite([{ input: svg, top: 0, left: 0 }])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return { image, mime: 'image/jpeg', sha256 };
}
