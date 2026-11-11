import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../auth/plugin.js';
import { AppError } from '../../errors.js';
import { getCatalog, getProduct } from './service.js';

export function registerCatalogRoutes(app: FastifyInstance): void {
  app.get('/catalog', { preHandler: requireAuth }, async (req) => getCatalog(req.server.db));

  app.get('/catalog/:productId', { preHandler: requireAuth }, async (req) => {
    const { productId } = req.params as { productId: string };
    const product = await getProduct(req.server.db, productId);
    if (!product) throw new AppError(404, 'NOT_FOUND', 'Продукт не найден');
    return product;
  });
}
