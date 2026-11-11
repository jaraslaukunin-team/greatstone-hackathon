import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../../auth/plugin.js';
import { AppError } from '../../errors.js';
import { verifySignature } from '../../storage/signedUrl.js';
import { MAX_PHOTO_BYTES } from '../catalog/service.js';
import { assertProjectAccess } from '../projects/service.js';
import { sniffMime } from './imageMeta.js';
import { addPhoto, deletePhoto, listPhotos, loadPhotoFile } from './service.js';

const tooLarge = () =>
  new AppError(413, 'FILE_TOO_LARGE', `Файл слишком большой: можно загрузить фото до ${MAX_PHOTO_BYTES / 1024 / 1024} МБ`);
const fileQuery = z.object({ exp: z.coerce.number().int(), sig: z.string() });

export function registerPhotoRoutes(app: FastifyInstance): void {
  const auth = { preHandler: requireAuth };

  app.post('/projects/:id/photos', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    // Права проверяются до чтения файла: чужой запрос не заставит нас буферизовать 15 МБ.
    await assertProjectAccess(req.server.db, req.user!, id, 'write');
    if (!req.isMultipart()) {
      throw new AppError(415, 'FORMAT_UNSUPPORTED', 'Отправьте файл как multipart/form-data в поле file');
    }
    const part = await req.file();
    if (!part || part.fieldname !== 'file') {
      throw new AppError(400, 'BAD_REQUEST', 'Прикрепите файл в поле file');
    }
    let data: Buffer;
    try {
      data = await part.toBuffer();
    } catch (e) {
      if ((e as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw tooLarge();
      throw e;
    }
    if (part.file.truncated) throw tooLarge();
    reply.code(201);
    return addPhoto(req.server, req.user!, id, data);
  });

  app.get('/projects/:id/photos', auth, async (req) => {
    const { id } = req.params as { id: string };
    return listPhotos(req.server, req.user!, id);
  });

  app.delete('/photos/:id', auth, async (req, reply) => {
    const { id } = req.params as { id: string };
    await deletePhoto(req.server, req.user!, id);
    return reply.code(204).send();
  });

  // Без токена: доступ даёт только подпись ссылки, выданной проверенному пользователю.
  app.get('/files/:photoId', async (req, reply) => {
    const { photoId } = req.params as { photoId: string };
    const q = fileQuery.safeParse(req.query);
    const invalid = new AppError(403, 'FORBIDDEN', 'Ссылка недействительна или устарела');
    if (!q.success) throw invalid;
    if (!verifySignature(photoId, q.data.exp, q.data.sig, req.server.config.fileUrlSecret, req.server.clock.now())) {
      throw invalid;
    }
    const file = await loadPhotoFile(req.server, photoId);
    if (!file) throw new AppError(404, 'NOT_FOUND', 'Фото не найдено');
    return reply
      .header('content-type', sniffMime(file.data) ?? 'application/octet-stream')
      .header('cache-control', 'private, max-age=300')
      .send(file.data);
  });
}
