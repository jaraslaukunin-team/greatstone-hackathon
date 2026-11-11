import type { Config } from '../../config.js';
import type { AiChatMessage } from '@picpac/shared';

export type ChatProvider = {
  readonly name: string;
  complete(input: {
    system: string;
    messages: AiChatMessage[];
    signal: AbortSignal;
  }): Promise<string>;
};

type AiaiChatConfig = Pick<Config, 'aiaiBaseUrl' | 'aiaiApiKey' | 'aiaiChatModel'>;

export class AiaiChatProvider implements ChatProvider {
  readonly name = 'aiai-chat';

  constructor(
    private readonly cfg: AiaiChatConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!cfg.aiaiApiKey) throw new Error('Для AI_PROVIDER=aiai нужна переменная AIAI_API_KEY');
  }

  async complete(input: {
    system: string;
    messages: AiChatMessage[];
    signal: AbortSignal;
  }): Promise<string> {
    const url = `${this.cfg.aiaiBaseUrl.replace(/\/+$/, '')}/chat/completions`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.aiaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.cfg.aiaiChatModel,
        temperature: 0.4,
        max_tokens: 800,
        messages: [{ role: 'system', content: input.system }, ...input.messages],
      }),
      signal: input.signal,
    });
    if (!res.ok) throw new Error(`aiai.by ответил статусом ${res.status}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Ответ aiai.by не содержит текста');
    return text;
  }
}

/** Детерминированные ответы для тестов и DEMO без ключа. */
export class StubChatProvider implements ChatProvider {
  readonly name = 'stub-chat';

  async complete(input: {
    system: string;
    messages: AiChatMessage[];
    signal: AbortSignal;
  }): Promise<string> {
    void input.signal;
    const last = input.messages.filter((m) => m.role === 'user').at(-1)?.content.toLowerCase() ?? '';
    if (/заказ|статус|где/.test(last)) {
      return 'Могу подсказать статус заказа. Откройте вкладку «Заказы» или укажите номер — я сверю его с вашей историей.';
    }
    if (/каталог|цен|книг|печат|пакет|услуг/.test(last)) {
      return 'В каталоге picPac есть фотокниги, печать фото и выпускные альбомы. Цены считаются на сервере через расчёт — выберите товар на главной.';
    }
    if (/привет|здравств|помощь/.test(last)) {
      return 'Здравствуйте! Я ассистент picPac: помогу с заказами, каталогом и советами по оформлению.';
    }
    return 'Я консультант picPac. Спросите про статус заказа, доставку или что выбрать в каталоге.';
  }
}

export function createChatProvider(config: Config): ChatProvider {
  if (config.aiProvider === 'stub') return new StubChatProvider();
  if (config.aiProvider === 'aiai') return new AiaiChatProvider(config);
  throw new Error(`Неизвестное значение AI_PROVIDER: ${config.aiProvider}`);
}
