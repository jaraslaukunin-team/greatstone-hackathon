import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../auth/plugin.js';
import { deleteMyData } from './service.js';

export function registerPrivacyRoutes(app: FastifyInstance): void {
  app.delete('/me/data', { preHandler: requireAuth }, async (req, reply) => {
    await deleteMyData(req.server, req.user!);
    return reply.code(204).send();
  });
}
