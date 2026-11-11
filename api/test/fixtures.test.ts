import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const meta = (name: string) => sharp(path.join(dir, name)).metadata();

describe('фикстуры фото', () => {
  it('photo-ok.jpg 2400×1600 с датой съёмки', async () => {
    const m = await meta('photo-ok.jpg');
    expect([m.format, m.width, m.height]).toEqual(['jpeg', 2400, 1600]);
    expect(m.exif).toBeDefined();
    expect(m.exif!.toString('latin1')).toContain('2024:06:15 12:30:00');
  });
  it('photo-small.jpg 700×500', async () => {
    const m = await meta('photo-small.jpg');
    expect([m.format, m.width, m.height]).toEqual(['jpeg', 700, 500]);
  });
  it('photo-exif-rotated.jpg хранится 2400×1600 с ориентацией 6', async () => {
    const m = await meta('photo-exif-rotated.jpg');
    expect([m.width, m.height, m.orientation]).toEqual([2400, 1600, 6]);
  });
  it('ai-result.jpg 1024×1024', async () => {
    const m = await meta('ai-result.jpg');
    expect([m.format, m.width, m.height]).toEqual(['jpeg', 1024, 1024]);
  });
});
