// Кладёт canvaskit.wasm (движок Skia для браузера, ~7 МБ) в public/, откуда его отдаёт Expo/сайт.
// Не кладём в public/assets/: префикс /assets/ на Expo web занят Metro → 404.
// expo export с output:single иногда не копирует .wasm из public/ в dist — поэтому
// после сборки передаём каталоги назначения аргументами: node scripts/copy-canvaskit.mjs dist-prod
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const skiaDir = dirname(require.resolve('@shopify/react-native-skia/package.json'));
const source = createRequire(join(skiaDir, 'package.json')).resolve('canvaskit-wasm/bin/full/canvaskit.wasm');

if (!existsSync(source)) {
  console.error('canvaskit.wasm не найден:', source);
  process.exit(1);
}

const targets = [join(root, 'public'), ...process.argv.slice(2).map((dir) => join(root, dir))];
for (const dir of targets) {
  mkdirSync(dir, { recursive: true });
  const dest = join(dir, 'canvaskit.wasm');
  copyFileSync(source, dest);
  console.log('canvaskit.wasm скопирован в', dest);
}
