// Генерирует синтетические тестовые фото (градиенты и фигуры, без людей).
// Запуск: npm run fixtures -w api
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const timeMachine = process.argv.includes('--time-machine');
const fixtureDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');
const outDir = timeMachine ? path.join(fixtureDir, 'time-machine') : fixtureDir;
mkdirSync(outDir, { recursive: true });

function scene(width: number, height: number, hue: number): Buffer {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${hue},70%,60%)"/>
    <stop offset="1" stop-color="hsl(${(hue + 60) % 360},70%,35%)"/>
  </linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${width * 0.3}" cy="${height * 0.35}" r="${Math.min(width, height) * 0.18}" fill="rgba(255,255,255,0.55)"/>
  <rect x="${width * 0.5}" y="${height * 0.45}" width="${width * 0.35}" height="${height * 0.3}" fill="rgba(0,0,0,0.3)"/>
  <polygon points="${width * 0.1},${height * 0.9} ${width * 0.35},${height * 0.55} ${width * 0.6},${height * 0.9}" fill="rgba(255,255,255,0.35)"/>
</svg>`;
  return Buffer.from(svg);
}

async function jpeg(name: string, width: number, height: number, hue: number, apply?: (s: sharp.Sharp) => sharp.Sharp) {
  let img = sharp(scene(width, height, hue)).jpeg({ quality: 80 });
  if (apply) img = apply(img);
  await img.toFile(path.join(outDir, name));
}

if (timeMachine) {
  const dates = ['2015:09:01', '2020:02:16', '2025:06:10'];
  for (const [chapter, date] of dates.entries()) {
    for (let frame = 0; frame < 10; frame++) {
      const minute = String(frame).padStart(2, '0');
      const width = frame % 3 === 0 ? 1800 : 2600;
      const height = frame % 3 === 0 ? 2600 : 1800;
      await jpeg(`${chapter + 1}-${minute}.jpg`, width, height, (chapter * 108 + frame * 4) % 360, (img) =>
        img.withExif({ IFD2: { DateTimeOriginal: `${date} 12:${minute}:00` } }),
      );
    }
  }
} else {
  // Основное фото с датой съёмки в EXIF.
  await jpeg('photo-ok.jpg', 2400, 1600, 200, (s) =>
    s.withExif({ IFD2: { DateTimeOriginal: '2024:06:15 12:30:00' } }),
  );
  // Низкое разрешение.
  await jpeg('photo-small.jpg', 700, 500, 20);
  // Пиксели 2400×1600, ориентация 6: на экране 1600×2400.
  await jpeg('photo-exif-rotated.jpg', 2400, 1600, 120, (s) => s.withMetadata({ orientation: 6 }));
  // Результат AI-редактора.
  await jpeg('ai-result.jpg', 1024, 1024, 300);
}

console.log('Фикстуры созданы в', outDir);
