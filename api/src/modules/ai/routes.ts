import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../auth/plugin.js';
import { parse } from '../../validation.js';
import { acceptConsent, getJob, requestEdit } from './service.js';

// Идентификаторы проверяются в сервисе: неверный id даёт 404, а не 400.
const editSchema = z.object({
  projectId: z.string(),
  photoId: z.string(),
  prompt: z.string().trim().min(1).max(500),
});

export function registerAiRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };

  app.post('/ai/consent', auth, async (req, reply) => {
    await acceptConsent(req.server, req.user!);
    return reply.code(204).send();
  });

  app.post('/ai/edit', auth, async (req, reply) => {
    const body = parse(editSchema, req.body);
    const result = await requestEdit(req.server, req.user!, body);
    reply.code(202);
    return result;
  });

  app.get('/ai/jobs/:id', auth, async (req) => {
    const { id } = req.params as { id: string };
    return getJob(req.server, req.user!, id);
  });
}
