import type { FastifyInstance } from 'fastify';
import { aiAdjustRequestSchema, aiChatRequestSchema, aiEditRequestSchema } from '@picpac/shared';
import { requireAuth } from '../../auth/plugin.js';
import {
  decryptAesGcm,
  deriveUserPayloadKey,
  isEncryptedBlobV1,
  parsePayloadMasterKey,
} from '../../crypto/payload.js';
import { AppError } from '../../errors.js';
import { parse } from '../../validation.js';
import { applyAdjust } from './adjust.js';
import { chatAssist } from './chat.js';
import { acceptConsent, getJob, requestEdit, revokeConsent } from './service.js';

function unwrapBody(app: FastifyInstance, userId: string, body: unknown): unknown {
  if (!isEncryptedBlobV1(body)) return body;
  const master = parsePayloadMasterKey(app.config.payloadEncryptionKey);
  if (!master) {
    throw new AppError(503, 'CRYPTO_DISABLED', 'Сервер не принимает зашифрованные тела: нет PAYLOAD_ENCRYPTION_KEY');
  }
  try {
    const key = deriveUserPayloadKey(master, userId);
    const plain = decryptAesGcm(key, body);
    return JSON.parse(plain.toString('utf8')) as unknown;
  } catch {
    throw new AppError(400, 'DECRYPT_FAILED', 'Не удалось расшифровать тело запроса');
  }
}

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
    const raw = unwrapBody(req.server, req.user!.id, req.body);
    const body = parse(aiEditRequestSchema, raw);
    const result = await requestEdit(req.server, req.user!, body);
    reply.code(202);
    return result;
  });

  app.post('/ai/adjust', auth, async (req) => {
    const raw = unwrapBody(req.server, req.user!.id, req.body);
    const body = parse(aiAdjustRequestSchema, raw);
    return applyAdjust(req.server, req.user!, body);
  });

  app.post('/ai/chat', auth, async (req) => {
    const raw = unwrapBody(req.server, req.user!.id, req.body);
    const body = parse(aiChatRequestSchema, raw);
    return chatAssist(req.server, req.user!, body);
  });

  app.get('/ai/jobs/:id', auth, async (req) => {
    const { id } = req.params as { id: string };
    return getJob(req.server, req.user!, id);
  });
}
