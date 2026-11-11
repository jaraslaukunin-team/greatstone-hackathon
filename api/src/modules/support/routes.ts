import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../auth/plugin.js';
import { parse } from '../../validation.js';
import { addMessage, createInteraction, getInteraction, listInteractions } from './service.js';

const text = (max: number) => z.string().trim().min(1).max(max);
const createSchema = z.object({ topic: text(200), body: text(4000) });
const messageSchema = z.object({ body: text(4000) });

export function registerSupportRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };

  app.post('/orders/:id/interactions', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(createSchema, req.body);
    reply.code(201);
    return createInteraction(req.server.db, req.user!, id, body);
  });

  app.get('/interactions', auth, async (req) => listInteractions(req.server.db, req.user!));

  app.get('/interactions/:id', auth, async (req) => {
    const { id } = req.params as { id: string };
    return getInteraction(req.server.db, req.user!, id);
  });

  app.post('/interactions/:id/messages', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(messageSchema, req.body);
    reply.code(201);
    return addMessage(req.server.db, req.user!, id, body.body);
  });
}
