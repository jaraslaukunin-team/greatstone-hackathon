import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { orderStatusSchema } from '@picpac/shared';
import { requireRole } from '../../auth/plugin.js';
import { parse } from '../../validation.js';
import { changeStatus, listAllOrders, listAudit } from './service.js';

const listQuery = z.object({ status: orderStatusSchema.optional() });
const statusBody = z.object({ status: orderStatusSchema, comment: z.string().max(500).optional() });
const auditQuery = z.object({ limit: z.coerce.number().int().min(1).max(500).default(50) });

export function registerOperatorRoutes(app: FastifyInstance): void {
  const operator = { preHandler: requireRole('operator') };

  app.get('/operator/orders', operator, async (req) => {
    const { status } = parse(listQuery, req.query);
    return listAllOrders(req.server.db, status);
  });

  app.post('/operator/orders/:id/status', operator, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(statusBody, req.body);
    return changeStatus(req.server.db, req.user!, id, body.status, body.comment, req.server.clock.now());
  });

  app.get('/operator/audit', operator, async (req) => {
    const { limit } = parse(auditQuery, req.query);
    return listAudit(req.server.db, limit);
  });
}
