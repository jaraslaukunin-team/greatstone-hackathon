import type { FastifyInstance } from 'fastify';
import { acceptInviteRequestSchema, updateMyMemberRequestSchema } from '@picpac/shared';
import { requireAuth } from '../../auth/plugin.js';
import { parse } from '../../validation.js';
import { acceptInvite, createInvite, getProgress, updateMyMember } from './service.js';

export function registerAlbumRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };

  app.post('/projects/:id/invites', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    reply.code(201);
    // Ссылка открывается в браузере; на телефоне её подхватит приложение.
    const base = req.server.config.publicUrl ?? `${req.protocol}://${req.host}`;
    return createInvite(req.server, req.user!, id, base);
  });

  app.post('/invites/accept', auth, async (req) => {
    const body = parse(acceptInviteRequestSchema, req.body);
    return acceptInvite(req.server, req.user!, body.token, body.childName, body.password);
  });

  app.patch('/projects/:id/members/me', auth, async (req) => {
    const { id } = req.params as { id: string };
    return updateMyMember(req.server, req.user!, id, parse(updateMyMemberRequestSchema, req.body));
  });

  app.get('/projects/:id/progress', auth, async (req) => {
    const { id } = req.params as { id: string };
    return getProgress(req.server.db, req.user!, id);
  });
}
