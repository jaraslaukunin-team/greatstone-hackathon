import type { FastifyInstance } from 'fastify';
import { createOrderRequestSchema } from '@picpac/shared';
import { requireAuth } from '../../auth/plugin.js';
import { AppError } from '../../errors.js';
import { parse } from '../../validation.js';
import { cancelOrder, createOrder, getOrder, listOrders } from './service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function registerOrderRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };

  app.post('/orders', auth, async (req, reply) => {
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !UUID.test(key)) {
      throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Нужен заголовок Idempotency-Key со значением uuid');
    }
    const body = parse(createOrderRequestSchema, req.body);
    const { order, created } = await createOrder(req.server, req.user!, key, body);
    reply.code(created ? 201 : 200);
    return order;
  });

  app.get('/orders', auth, async (req) => listOrders(req.server.db, req.user!));

  app.get('/orders/:id', auth, async (req) => {
    const { id } = req.params as { id: string };
    return getOrder(req.server.db, req.user!, id);
  });

  app.post('/orders/:id/cancel', auth, async (req) => {
    const { id } = req.params as { id: string };
    return cancelOrder(req.server.db, req.user!, id, req.server.clock.now());
  });
}
