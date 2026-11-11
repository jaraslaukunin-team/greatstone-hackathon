import type { Config } from '../../config.js';
import { sniffMime } from '../photos/imageMeta.js';
import type { ImageEditProvider } from './provider.js';

type AiaiConfig = Pick<Config, 'aiaiBaseUrl' | 'aiaiApiKey' | 'aiaiModel' | 'aiaiEditMode'>;
type Input = Parameters<ImageEditProvider['edit']>[0];

const DATA_URL = /^data:(image\/[\w.+-]+);base64,(.+)$/s;

// Формат передачи фото на aiai.by в документации не описан, поэтому поддержаны два режима:
// 'images' (multipart на /images/edits) и 'chat' (картинка как data URL в /chat/completions).
// Какой из них работает, показывает scripts/ai-probe.ts.
export class AiaiProvider implements ImageEditProvider {
  readonly name = 'aiai';

  constructor(
    private readonly cfg: AiaiConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!cfg.aiaiApiKey) throw new Error('Для AI_PROVIDER=aiai нужна переменная AIAI_API_KEY');
    if (!cfg.aiaiModel) throw new Error('Для AI_PROVIDER=aiai нужна переменная AIAI_MODEL');
  }

  edit(input: Input): Promise<{ image: Buffer; mime: string }> {
    return this.cfg.aiaiEditMode === 'chat' ? this.viaChat(input) : this.viaImages(input);
  }

  private url(path: string): string {
    return `${this.cfg.aiaiBaseUrl.replace(/\/+$/, '')}${path}`;
  }

  private async post(path: string, init: RequestInit, signal: AbortSignal): Promise<unknown> {
    const res = await this.fetchImpl(this.url(path), {
      ...init,
      method: 'POST',
      headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${this.cfg.aiaiApiKey}` },
      signal,
    });
    // Тело ответа и ключ в текст ошибки не попадают: их место в журнале провайдера, а не у пользователя.
    if (!res.ok) throw new Error(`aiai.by ответил статусом ${res.status}`);
    return res.json();
  }

  private async viaImages({ image, mime, prompt, size, signal }: Input) {
    const form = new FormData();
    form.set('model', this.cfg.aiaiModel);
    form.set('prompt', prompt);
    if (size) form.set('size', size);
    form.set('image', new Blob([new Uint8Array(image)], { type: mime }), mime === 'image/png' ? 'image.png' : 'image.jpg');
    const json = (await this.post('/images/edits', { body: form }, signal)) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error('Ответ aiai.by не содержит изображения');
    const out = Buffer.from(b64, 'base64');
    return { image: out, mime: sniffMime(out) ?? 'application/octet-stream' };
  }

  private async viaChat({ image, mime, prompt, signal }: Input) {
    const body = {
      model: this.cfg.aiaiModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${image.toString('base64')}` } },
          ],
        },
      ],
    };
    const json = (await this.post(
      '/chat/completions',
      { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
      signal,
    )) as { choices?: { message?: { images?: { image_url?: { url?: string } }[] } }[] };
    const match = DATA_URL.exec(json.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? '');
    if (!match) throw new Error('Ответ aiai.by не содержит изображения');
    return { image: Buffer.from(match[2]!, 'base64'), mime: match[1]! };
  }
}
