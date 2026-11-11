import type { FastifyInstance } from 'fastify';
import { quoteRequestSchema } from '@picpac/shared';
import { requireAuth } from '../../auth/plugin.js';
import { parse } from '../../validation.js';
import { computeQuote } from './service.js';

export function registerQuoteRoutes(app: FastifyInstance): void {
  app.post('/price-quote', { preHandler: requireAuth }, async (req) => {
    const body = parse(quoteRequestSchema, req.body);
    return computeQuote(req.server.db, body, req.server.clock.now());
  });
}
