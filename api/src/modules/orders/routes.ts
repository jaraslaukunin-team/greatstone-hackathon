import type { FastifyInstance } from 'fastify';
import { createOrderRequestSchema } from '@picpac/shared';
import { requireAuth } from '../../auth/plugin.js';
import { AppError } from '../../errors.js';
import { parse } from '../../validation.js';
import { z } from 'zod';
import { duplicateProject } from '../projects/service.js';
import { cancelOrder, createOrder, getOrder, listOrders, loadOrder, setOrderFavorite } from './service.js';

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

  app.post('/orders/:id/favorite', auth, async (req) => {
    const { id } = req.params as { id: string };
    const { favorite } = parse(z.object({ favorite: z.boolean() }), req.body);
    return setOrderFavorite(req.server.db, req.user!, id, favorite);
  });

  app.post('/orders/:id/repeat', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    const order = await loadOrder(req.server.db, req.user!, id, { operatorMay: false });
    if (!order.projectId) throw new AppError(409, 'ORDER_PROJECT_MISSING', 'Макет этого заказа больше недоступен');
    const project = await duplicateProject(req.server, req.user!, order.projectId);
    return reply.code(201).send(project);
  });

  app.post('/orders/:id/cancel', auth, async (req) => {
    const { id } = req.params as { id: string };
    return cancelOrder(req.server.db, req.user!, id, req.server.clock.now());
  });
}
