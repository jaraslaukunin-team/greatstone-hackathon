import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../auth/plugin.js';
import { AppError } from '../../errors.js';
import { MAX_PHOTO_BYTES } from '../catalog/service.js';
import { parse } from '../../validation.js';
import { addMessage, addPhotoMessage, createInteraction, getInteraction, getMessageAttachment, listInteractions } from './service.js';

const text = (max: number) => z.string().trim().min(1).max(max);
const createSchema = z.object({ topic: text(200), body: text(4000) });
const messageSchema = z.object({ body: text(4000) });

const tooLarge = () =>
  new AppError(413, 'FILE_TOO_LARGE', `Файл слишком большой: можно загрузить фото до ${MAX_PHOTO_BYTES / 1024 / 1024} МБ`);

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

  app.get('/interactions/:id/attachments/:messageId', auth, async (req, reply) => {
    const { id, messageId } = req.params as { id: string; messageId: string };
    const { data, mime } = await getMessageAttachment(req.server, req.user!, id, messageId);
    return reply
      .header('content-type', mime)
      .header('cache-control', 'private, max-age=300')
      .send(data);
  });
}
