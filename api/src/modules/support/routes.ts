import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../auth/plugin.js';
import { AppError } from '../../errors.js';
import { MAX_PHOTO_BYTES } from '../catalog/service.js';
import { parse } from '../../validation.js';
import {
  addMessage,
  addPhotoMessage,
  attachmentSigner,
  createInteraction,
  getInteraction,
  getMessageAttachment,
  getMessageAttachmentBySignature,
  listInteractions,
} from './service.js';

const text = (max: number) => z.string().trim().min(1).max(max);
const createSchema = z.object({ topic: text(200), body: text(4000) });
const messageSchema = z.object({ body: text(4000) });
const signatureQuery = z.object({ exp: z.coerce.number().int(), sig: z.string().min(1) });

const tooLarge = () =>
  new AppError(413, 'FILE_TOO_LARGE', `Файл слишком большой: можно загрузить фото до ${MAX_PHOTO_BYTES / 1024 / 1024} МБ`);

export function registerSupportRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };

  app.post('/orders/:id/interactions', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(createSchema, req.body);
    reply.code(201);
    return createInteraction(req.server.db, req.user!, id, body, attachmentSigner(req.server));
  });

  app.get('/interactions', auth, async (req) => listInteractions(req.server.db, req.user!, attachmentSigner(req.server)));

  app.get('/interactions/:id', auth, async (req) => {
    const { id } = req.params as { id: string };
    return getInteraction(req.server.db, req.user!, id, attachmentSigner(req.server));
  });

  app.post('/interactions/:id/messages', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(messageSchema, req.body);
    reply.code(201);
    return addMessage(req.server.db, req.user!, id, body.body, attachmentSigner(req.server));
  });

  app.post('/interactions/:id/messages/photo', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!req.isMultipart()) {
      throw new AppError(415, 'FORMAT_UNSUPPORTED', 'Отправьте файл как multipart/form-data в поле file');
    }
    const parts = req.parts();
    let data: Buffer | undefined;
    let body = '';
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        let buf: Buffer;
        try {
          buf = await part.toBuffer();
        } catch (e) {
          if ((e as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw tooLarge();
          throw e;
        }
        if (part.file.truncated) throw tooLarge();
        data = buf;
      } else if (part.type === 'field' && part.fieldname === 'body') {
        body = String(part.value).trim().slice(0, 4000);
      }
    }
    if (!data) {
      throw new AppError(400, 'BAD_REQUEST', 'Прикрепите файл в поле file');
    }
    reply.code(201);
    return addPhotoMessage(req.server, req.user!, id, data, body);
  });

  // <img> не шлёт Authorization, поэтому открывает и подписанная ссылка (её выдаёт DTO проверенному пользователю),
  // и обычный запрос с токеном. Без подписи и без токена — 401.
  app.get('/interactions/:id/attachments/:messageId', async (req, reply) => {
    const { id, messageId } = req.params as { id: string; messageId: string };
    const q = signatureQuery.safeParse(req.query);
    let file: { data: Buffer; mime: string };
    if (q.success) {
      file = await getMessageAttachmentBySignature(req.server, id, messageId, q.data.exp, q.data.sig);
    } else {
      await requireAuth(req, reply);
      file = await getMessageAttachment(req.server, req.user!, id, messageId);
    }
    return reply
      .header('content-type', file.mime)
      .header('cache-control', 'private, max-age=300')
      .send(file.data);
  });
}
