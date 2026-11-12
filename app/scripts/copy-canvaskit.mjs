// Кладёт canvaskit.wasm (движок Skia для браузера, ~7 МБ) в public/, откуда его отдаёт Expo/сайт.
// Не кладём в public/assets/: префикс /assets/ на Expo web занят Metro → 404.
// Запускается перед start, web и web:build; сам файл в git не хранится.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// canvaskit-wasm лежит рядом с react-native-skia, а не обязательно в корне node_modules.
const require = createRequire(join(root, 'package.json'));
const skiaDir = dirname(require.resolve('@shopify/react-native-skia/package.json'));
const source = createRequire(join(skiaDir, 'package.json')).resolve('canvaskit-wasm/bin/full/canvaskit.wasm');

if (!existsSync(source)) {
  console.error('canvaskit.wasm не найден:', source);
  process.exit(1);
}
const publicDir = join(root, 'public');
mkdirSync(publicDir, { recursive: true });
copyFileSync(source, join(publicDir, 'canvaskit.wasm'));
console.log('canvaskit.wasm скопирован в public/canvaskit.wasm');
