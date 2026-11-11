import Fastify, { type FastifyInstance } from 'fastify';
import { registerErrorHandling } from './errors.js';
import type { Config } from './config.js';

export type BuildOptions = { logger?: boolean };

// Подключение к БД здесь не открывается: /health работает и при остановленной БД.
export async function buildApp(
  _config: Config,
  opts: BuildOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true });
  registerErrorHandling(app);
  app.get('/health', async () => ({ status: 'ok' }));
  return app;
}
