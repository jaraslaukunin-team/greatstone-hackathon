import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig, type Config } from './config.js';
import { registerAuth } from './auth/plugin.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerErrorHandling } from './errors.js';
import { registerStorage } from './storage/plugin.js';
import { registerAiRoutes } from './modules/ai/routes.js';
import { registerAi } from './modules/ai/plugin.js';
import { registerAlbumRoutes } from './modules/albums/routes.js';
import { registerCatalogRoutes } from './modules/catalog/routes.js';
import { MAX_PHOTO_BYTES } from './modules/catalog/service.js';
import { registerOperatorRoutes } from './modules/operator/routes.js';
import { registerOrderRoutes } from './modules/orders/routes.js';
import { registerPhotoRoutes } from './modules/photos/routes.js';
import { registerCryptoRoutes } from './modules/crypto/routes.js';
import { registerPrivacyRoutes } from './modules/privacy/routes.js';
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
  // За Caddy один прокси: из X-Forwarded-* берётся адрес, который дописал он, а не подставленный клиентом.
  const app = Fastify({ logger: !silent, trustProxy: (_address, hop) => hop < 1 });
  app.decorate('config', config);
  registerErrorHandling(app);
  // Заголовки безопасности на всех ответах; JSON с данными пользователя не кэшируется ни браузером, ни прокси.
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    if (!reply.hasHeader('cache-control') && String(reply.getHeader('content-type') ?? '').includes('application/json')) {
      reply.header('Cache-Control', 'no-store');
    }
    return payload;
  });
  registerAuth(app);
  registerStorage(app);
  registerAi(app);
  await app.register(multipart, { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } });
  registerAuthRoutes(app);
  registerCatalogRoutes(app);
  registerQuoteRoutes(app);
  registerProjectRoutes(app);
  registerPhotoRoutes(app);
  registerOrderRoutes(app);
  registerOperatorRoutes(app);
  registerSupportRoutes(app);
  registerAlbumRoutes(app);
  registerAiRoutes(app);
  registerCryptoRoutes(app);
  registerPrivacyRoutes(app);
  app.get('/health', async () => ({ status: 'ok' }));
  return app;
}
