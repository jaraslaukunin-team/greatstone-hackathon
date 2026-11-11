import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { layoutSchema } from '@picpac/shared';
import { requireAuth } from '../../auth/plugin.js';
import { AppError } from '../../errors.js';
import { parse } from '../../validation.js';
import {
  assertProjectAccess,
  createProject,
  deleteProject,
  listProjects,
  saveLayout,
  setJoinPassword,
  toProjectDTO,
} from './service.js';

const createSchema = z.object({
  variantId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  isShared: z.boolean().optional(),
  expectedMembers: z.number().int().min(0).optional(),
  joinPassword: z.string().min(4).max(64).optional(),
});
const passwordSchema = z.object({ password: z.string().min(4).max(64).nullable() });
const saveSchema = z.object({ layout: z.unknown(), version: z.number().int().positive() });

export function registerProjectRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };

  app.post('/projects', auth, async (req, reply) => {
    const body = parse(createSchema, req.body);
    reply.code(201);
    return createProject(req.server.db, req.user!, body);
  });

  app.get('/projects', auth, async (req) => listProjects(req.server.db, req.user!));

  app.get('/projects/:id', auth, async (req) => {
    const { id } = req.params as { id: string };
    return toProjectDTO(await assertProjectAccess(req.server.db, req.user!, id, 'read'));
  });

  app.put('/projects/:id', auth, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(saveSchema, req.body);
    const layout = layoutSchema.safeParse(body.layout);
    if (!layout.success) throw new AppError(422, 'LAYOUT_INVALID', 'Макет заполнен неверно');
    return saveLayout(req.server.db, req.user!, id, layout.data, body.version);
  });

  app.put('/projects/:id/password', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(passwordSchema, req.body);
    await setJoinPassword(req.server.db, req.user!, id, body.password);
    return reply.code(204).send();
  });

  app.delete('/projects/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    await deleteProject(req.server.db, req.server.storage, req.user!, id);
    return reply.code(204).send();
  });
}
