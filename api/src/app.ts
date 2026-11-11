import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig, type Config } from './config.js';
import { registerAuth } from './auth/plugin.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerErrorHandling } from './errors.js';
import { registerStorage } from './storage/plugin.js';
import { registerCatalogRoutes } from './modules/catalog/routes.js';
import { MAX_PHOTO_BYTES } from './modules/catalog/service.js';
import { registerOperatorRoutes } from './modules/operator/routes.js';
import { registerOrderRoutes } from './modules/orders/routes.js';
import { registerPhotoRoutes } from './modules/photos/routes.js';
import { registerProjectRoutes } from './modules/projects/routes.js';
import { registerQuoteRoutes } from './modules/quote/routes.js';
import { registerSupportRoutes } from './modules/support/routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
  }
}

// Подключение к БД здесь не открывается: /health работает и при остановленной БД.
// Обязательные поля конфигурации можно передать через overrides, тогда окружение не нужно.
export async function buildApp(overrides: Partial<Config> = {}): Promise<FastifyInstance> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (overrides.databaseUrl !== undefined) env.DATABASE_URL = overrides.databaseUrl;
  if (overrides.jwtSecret !== undefined) env.JWT_SECRET = overrides.jwtSecret;
  if (overrides.fileUrlSecret !== undefined) env.FILE_URL_SECRET = overrides.fileUrlSecret;
  const config: Config = { ...loadConfig(env), ...overrides };

  const silent = process.env.NODE_ENV === 'test' || process.env.VITEST !== undefined;
  const app = Fastify({ logger: !silent });
  app.decorate('config', config);
  registerErrorHandling(app);
  registerAuth(app);
  registerStorage(app);
  await app.register(multipart, { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } });
  registerAuthRoutes(app);
  registerCatalogRoutes(app);
  registerQuoteRoutes(app);
  registerProjectRoutes(app);
  registerPhotoRoutes(app);
  registerOrderRoutes(app);
  registerOperatorRoutes(app);
  registerSupportRoutes(app);
  app.get('/health', async () => ({ status: 'ok' }));
  return app;
}
