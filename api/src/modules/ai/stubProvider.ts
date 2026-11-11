import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { ImageEditProvider } from './provider.js';

const RESULT = fileURLToPath(new URL('../../../fixtures/ai-result.jpg', import.meta.url));

// Всегда возвращает заранее подготовленную картинку: для разработки, тестов и запасного варианта на защите.
export class StubProvider implements ImageEditProvider {
  readonly name = 'stub';

  async edit(): Promise<{ image: Buffer; mime: string }> {
    return { image: await readFile(RESULT), mime: 'image/jpeg' };
  }
}
