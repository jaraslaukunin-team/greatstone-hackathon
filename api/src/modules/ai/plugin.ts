import type { FastifyInstance } from 'fastify';
import type { Config } from '../../config.js';
import { AiaiProvider } from './aiaiProvider.js';
import { createChatProvider, type ChatProvider } from './chatProvider.js';
import type { ImageEditProvider } from './provider.js';
import { StubProvider } from './stubProvider.js';

export const AI_TIMEOUT_MS = 90_000;

export type AiRuntime = {
  provider: ImageEditProvider;
  chat: ChatProvider;
  timeoutMs: number;
  inflight: Set<Promise<void>>;
  controllers: Set<AbortController>;
  // Ждёт завершения всех задач, которые выполняются в процессе (для тестов и остановки сервера).
  idle(): Promise<void>;
};

declare module 'fastify' {
  interface FastifyInstance {
    ai: AiRuntime;
  }
}

export function createProvider(config: Config): ImageEditProvider {
  if (config.aiProvider === 'stub') return new StubProvider();
  if (config.aiProvider === 'aiai') return new AiaiProvider(config);
  throw new Error(`Неизвестное значение AI_PROVIDER: ${config.aiProvider} (допустимо stub или aiai)`);
}

export function registerAi(app: FastifyInstance): void {
  const inflight = new Set<Promise<void>>();
  const controllers = new Set<AbortController>();
  const ai: AiRuntime = {
    provider: createProvider(app.config),
    chat: createChatProvider(app.config),
    timeoutMs: AI_TIMEOUT_MS,
    inflight,
    controllers,
    async idle() {
      while (inflight.size > 0) await Promise.allSettled([...inflight]);
    },
  };
  app.decorate('ai', ai);
  // При остановке прерываем зависшие запросы к провайдеру и ждём, пока задачи закончат запись.
  app.addHook('onClose', async () => {
    for (const c of controllers) c.abort();
    await ai.idle();
  });
}
