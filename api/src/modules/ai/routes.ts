import type { FastifyInstance } from 'fastify';
import { aiAdjustRequestSchema, aiChatRequestSchema, aiEditRequestSchema } from '@picpac/shared';
import { requireAuth } from '../../auth/plugin.js';
import { parse } from '../../validation.js';
import { applyAdjust } from './adjust.js';
import { chatAssist } from './chat.js';
import { acceptConsent, getJob, requestEdit, revokeConsent } from './service.js';

export function registerAiRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };

  app.post('/ai/consent', auth, async (req, reply) => {
    await acceptConsent(req.server, req.user!);
    return reply.code(204).send();
  });

  app.delete('/ai/consent', auth, async (req, reply) => {
    await revokeConsent(req.server, req.user!);
    return reply.code(204).send();
  });

  app.post('/ai/edit', auth, async (req, reply) => {
    const body = parse(aiEditRequestSchema, req.body);
    const result = await requestEdit(req.server, req.user!, body);
    reply.code(202);
    return result;
  });

  app.post('/ai/adjust', auth, async (req) => {
    const body = parse(aiAdjustRequestSchema, req.body);
    return applyAdjust(req.server, req.user!, body);
  });

  app.post('/ai/chat', auth, async (req) => {
    const body = parse(aiChatRequestSchema, req.body);
    return chatAssist(req.server, req.user!, body);
  });

  app.get('/ai/jobs/:id', auth, async (req) => {
    const { id } = req.params as { id: string };
    return getJob(req.server, req.user!, id);
  });
}
