// Проба aiai.by: какой режим передачи фото работает, images или chat.
// Запуск (нужны AIAI_API_KEY и AIAI_MODEL в .env в корне репозитория): npm run ai:probe -w api
import { mkdtempSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AiaiProvider } from '../src/modules/ai/aiaiProvider.js';

try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
  // .env может отсутствовать: тогда значения берутся из окружения.
}

const image = await readFile(fileURLToPath(new URL('../fixtures/photo-ok.jpg', import.meta.url)));
const outDir = mkdtempSync(join(tmpdir(), 'picpac-ai-probe-'));
let worked = 0;

for (const mode of ['images', 'chat'] as const) {
  try {
    const provider = new AiaiProvider({
      aiaiBaseUrl: process.env.AIAI_BASE_URL || 'https://api.aiai.by/v1',
      aiaiApiKey: process.env.AIAI_API_KEY ?? '',
      aiaiModel: process.env.AIAI_MODEL ?? '',
      aiaiEditMode: mode,
    });
    const started = Date.now();
    const out = await provider.edit({
      image,
      mime: 'image/jpeg',
      prompt: 'Сделай небо за объектом закатным',
      signal: AbortSignal.timeout(90_000),
    });
    const file = join(outDir, `result-${mode}.jpg`);
    writeFileSync(file, out.image);
    console.log(`OK ${mode} (${Date.now() - started} мс, ${out.image.length} байт, ${out.mime}) -> ${file}`);
    worked++;
  } catch (e) {
    console.log(`FAIL ${mode}: ${(e as Error).message}`);
  }
}
if (worked === 0) process.exitCode = 1;
