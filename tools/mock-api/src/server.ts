import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import {
  createOrderRequestSchema,
  createProjectRequestSchema,
  quoteRequestSchema,
  requestCodeSchema,
  updateProjectRequestSchema,
  verifyCodeSchema,
} from '@picpac/shared';
import {
  PROMO,
  calcMockPrice,
  catalog,
  createState,
  findVariant,
  newId,
  type MockState,
} from './data.js';

const state: MockState = createState();
let orderSeq = 142;

function error(status: number, code: string, message: string) {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = status;
  err.code = code;
  return err;
}

function auth(req: { headers: Record<string, string | string[] | undefined> }) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    throw error(401, 'UNAUTHORIZED', 'Нужна авторизация');
  }
  const token = header.slice('Bearer '.length);
  const session = state.sessions.get(token);
  if (!session) throw error(401, 'UNAUTHORIZED', 'Сессия недействительна');
  return session;
}

function normalizePromo(raw: string) {
  return raw.trim().toUpperCase();
}

async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(multipart);

  app.setErrorHandler((err, _req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    const code = (err as { code?: string }).code ?? 'INTERNAL';
    const message =
      status >= 500 ? 'Внутренняя ошибка сервера' : err.message || 'Ошибка';
    reply.status(status).send({ error: { code, message } });
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/auth/guest', async () => {
    const user = {
      id: newId(),
      role: 'customer' as const,
      displayName: 'Гость',
      isGuest: true,
      aiConsent: false,
    };
    const token = newId();
    state.users.set(user.id, user);
    state.sessions.set(token, { token, user });
    return { token, user };
  });

  app.post('/auth/request-code', async (req) => {
    const body = requestCodeSchema.parse(req.body);
    state.authCodes.set(body.contact, {
      code: '000000',
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return { ok: true };
  });

  app.post('/auth/verify-code', async (req) => {
    const body = verifyCodeSchema.parse(req.body);
    const entry = state.authCodes.get(body.contact);
    if (!entry) throw error(401, 'CODE_INVALID', 'Неверный код');
    if (entry.expiresAt < Date.now()) throw error(401, 'CODE_EXPIRED', 'Код истёк');
    if (body.code !== entry.code) throw error(401, 'CODE_INVALID', 'Неверный код');

    let user = [...state.users.values()].find(
      (u) => !u.isGuest && u.displayName === body.contact,
    );
    if (!user) {
      user = {
        id: newId(),
        role: body.contact.includes('operator') ? 'operator' : 'customer',
        displayName: body.contact,
        isGuest: false,
        aiConsent: false,
      };
      state.users.set(user.id, user);
    }
    const token = newId();
    state.sessions.set(token, { token, user });
    return { token, user };
  });

  app.get('/me', async (req) => auth(req).user);

  app.delete('/me/data', async (req) => {
    const session = auth(req);
    for (const [id, project] of state.projects) {
      if (project.ownerId === session.user.id) {
        for (const [photoId, photo] of state.photos) {
          if (photo.projectId === id) state.photos.delete(photoId);
        }
        state.projects.delete(id);
      }
    }
    for (const order of state.orders.values()) {
      if (order.customerId === session.user.id) {
        order.customerId = '';
      }
    }
    state.users.delete(session.user.id);
    state.sessions.delete(session.token);
    return { ok: true };
  });

  app.get('/catalog', async (req) => {
    auth(req);
    return catalog;
  });

  app.get('/catalog/:id', async (req) => {
    auth(req);
    const id = (req.params as { id: string }).id;
    const product = catalog.products.find((p) => p.id === id);
    if (!product) throw error(404, 'NOT_FOUND', 'Продукт не найден');
    return product;
  });

  app.post('/price-quote', async (req) => {
    auth(req);
    const body = quoteRequestSchema.parse(req.body);
    const variant = findVariant(body.variantId);
    if (!variant) throw error(404, 'NOT_FOUND', 'Вариант не найден');
    if (body.pages < variant.pagesMin || body.pages > variant.pagesMax) {
      throw error(422, 'PAGES_OUT_OF_RANGE', 'Число страниц вне диапазона');
    }

    let discountPercent = 0;
    let promoApplied = false;
    if (body.promoCode) {
      const code = normalizePromo(body.promoCode);
      const promo = PROMO[code];
      if (!promo) throw error(422, 'PROMO_UNKNOWN', 'Промокод не найден');
      if (promo.expired) throw error(422, 'PROMO_EXPIRED', 'Промокод истёк');
      discountPercent = promo.percent;
      promoApplied = true;
    }

    const breakdown = calcMockPrice({
      variant,
      pages: body.pages,
      quantity: body.quantity,
      discountPercent,
      deliveryId: body.delivery,
    });

    return {
      ...breakdown,
      currency: 'BYN' as const,
      promoApplied,
    };
  });

  app.post('/projects', async (req) => {
    const session = auth(req);
    const body = createProjectRequestSchema.parse(req.body);
    const variant = findVariant(body.variantId);
    if (!variant) throw error(404, 'NOT_FOUND', 'Вариант не найден');
    const now = new Date().toISOString();
    const project = {
      id: newId(),
      title: body.title,
      variantId: body.variantId,
      ownerId: session.user.id,
      status: 'draft' as const,
      isShared: Boolean(body.isShared),
      expectedMembers: body.expectedMembers ?? null,
      layout: { pages: [] },
      version: 1,
      updatedAt: now,
    };
    state.projects.set(project.id, project);
    if (project.isShared) {
      state.albums.set(project.id, {
        projectId: project.id,
        expectedMembers: body.expectedMembers ?? 1,
        members: new Set([session.user.id]),
        invites: new Map(),
      });
    }
    return project;
  });

  app.get('/projects', async (req) => {
    const session = auth(req);
    return [...state.projects.values()].filter((p) => p.ownerId === session.user.id);
  });

  app.get('/projects/:id', async (req) => {
    const session = auth(req);
    const id = (req.params as { id: string }).id;
    const project = state.projects.get(id);
    if (!project || project.ownerId !== session.user.id) {
      throw error(404, 'NOT_FOUND', 'Проект не найден');
    }
    return project;
  });

  app.put('/projects/:id', async (req) => {
    const session = auth(req);
    const id = (req.params as { id: string }).id;
    const project = state.projects.get(id);
    if (!project || project.ownerId !== session.user.id) {
      throw error(404, 'NOT_FOUND', 'Проект не найден');
    }
    if (project.status === 'ordered') {
      throw error(409, 'PROJECT_ORDERED', 'Проект уже в заказе');
    }
    const body = updateProjectRequestSchema.parse(req.body);
    if (body.version !== project.version) {
      throw error(409, 'VERSION_CONFLICT', 'Версия устарела');
    }
    const next = {
      ...project,
      title: body.title ?? project.title,
      layout: body.layout ?? project.layout,
      version: project.version + 1,
      updatedAt: new Date().toISOString(),
    };
    state.projects.set(id, next);
    return next;
  });

  async function addPhoto(projectId: string, userId: string, source: 'gallery' | 'ai' = 'gallery') {
    const photo = {
      id: newId(),
      projectId,
      width: 2400,
      height: 1600,
      takenAt: new Date().toISOString(),
      url: `https://mock.local/photos/${newId()}.jpg`,
      uploadedBy: userId,
      source,
    };
    state.photos.set(photo.id, photo);
    const { projectId: _p, ...dto } = photo;
    return dto;
  }

  app.post('/projects/:id/photos', async (req) => {
    const session = auth(req);
    const id = (req.params as { id: string }).id;
    const project = state.projects.get(id);
    if (!project || project.ownerId !== session.user.id) {
      throw error(404, 'NOT_FOUND', 'Проект не найден');
    }

    const contentType = String(req.headers['content-type'] ?? '');
    if (contentType.includes('multipart/form-data')) {
      const file = await req.file();
      if (!file) throw error(400, 'FILE_REQUIRED', 'Нужен файл');
      const buf = await file.toBuffer();
      if (buf.byteLength > catalog.limits.maxPhotoBytes) {
        throw error(413, 'FILE_TOO_LARGE', 'Файл слишком большой');
      }
      if (!catalog.limits.allowedMimeTypes.includes(file.mimetype as 'image/jpeg' | 'image/png')) {
        throw error(415, 'UNSUPPORTED_MEDIA', 'Поддерживаются JPEG и PNG');
      }
      return addPhoto(id, session.user.id);
    }

    // JSON shortcut for Expo Go / mock without real binary
    return addPhoto(id, session.user.id);
  });

  app.delete('/projects/:id/photos/:photoId', async (req) => {
    const session = auth(req);
    const { id, photoId } = req.params as { id: string; photoId: string };
    const project = state.projects.get(id);
    if (!project || project.ownerId !== session.user.id) {
      throw error(404, 'NOT_FOUND', 'Проект не найден');
    }
    state.photos.delete(photoId);
    return { ok: true };
  });

  app.post('/orders', async (req) => {
    const session = auth(req);
    const body = createOrderRequestSchema.parse(req.body);
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !key) {
      throw error(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Нужен Idempotency-Key');
    }

    const project = state.projects.get(body.projectId);
    if (!project || project.ownerId !== session.user.id) {
      throw error(404, 'NOT_FOUND', 'Проект не найден');
    }

    const variant = findVariant(project.variantId);
    if (!variant) throw error(404, 'NOT_FOUND', 'Вариант не найден');

    const pages = Math.max(variant.pagesMin, project.layout.pages.length || variant.pagesMin);
    const quote = calcMockPrice({
      variant,
      pages,
      quantity: 1,
      discountPercent: body.promoCode ? PROMO[normalizePromo(body.promoCode)]?.percent ?? 0 : 0,
      deliveryId: body.delivery,
    });

    if (quote.totalKop !== body.expectedTotalKop) {
      throw error(409, 'PRICE_CHANGED', 'Цена изменилась');
    }

    const requestHash = JSON.stringify({
      projectId: body.projectId,
      delivery: body.delivery,
      promoCode: body.promoCode ?? null,
      expectedTotalKop: body.expectedTotalKop,
    });

    const existing = [...state.orders.values()].find(
      (o) => o.customerId === session.user.id && o.idempotencyKey === key,
    );
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw error(422, 'IDEMPOTENCY_KEY_REUSED', 'Ключ уже использован с другим телом');
      }
      return existing;
    }

    const now = new Date().toISOString();
    const order = {
      id: newId(),
      number: `PP-${String(orderSeq++).padStart(6, '0')}`,
      projectId: project.id,
      status: 'accepted' as const,
      totalKop: quote.totalKop,
      currency: 'BYN' as const,
      delivery: body.delivery,
      createdAt: now,
      history: [
        {
          status: 'accepted' as const,
          at: now,
          changedBy: session.user.id,
        },
      ],
      customerId: session.user.id,
      requestHash,
      idempotencyKey: key,
    };
    project.status = 'ordered';
    state.projects.set(project.id, project);
    state.orders.set(order.id, order);
    return order;
  });

  app.get('/orders', async (req) => {
    const session = auth(req);
    if (session.user.role === 'operator') return [...state.orders.values()];
    return [...state.orders.values()].filter((o) => o.customerId === session.user.id);
  });

  app.get('/orders/:id', async (req) => {
    const session = auth(req);
    const id = (req.params as { id: string }).id;
    const order = state.orders.get(id);
    if (!order) throw error(404, 'NOT_FOUND', 'Заказ не найден');
    if (session.user.role !== 'operator' && order.customerId !== session.user.id) {
      throw error(404, 'NOT_FOUND', 'Заказ не найден');
    }
    const interactionIds = [...state.interactions.values()]
      .filter((i) => i.orderId === id)
      .map((i) => i.id);
    return { ...order, interactionIds };
  });

  app.post('/orders/:id/cancel', async (req) => {
    const session = auth(req);
    const id = (req.params as { id: string }).id;
    const order = state.orders.get(id);
    if (!order || order.customerId !== session.user.id) {
      throw error(404, 'NOT_FOUND', 'Заказ не найден');
    }
    if (order.status !== 'accepted') {
      throw error(409, 'CANCEL_FORBIDDEN', 'Отменить можно только новый заказ');
    }
    order.status = 'cancelled';
    order.history.push({
      status: 'cancelled',
      at: new Date().toISOString(),
      changedBy: session.user.id,
    });
    return order;
  });

  const transitions: Record<string, string[]> = {
    accepted: ['moderation', 'cancelled'],
    moderation: ['production', 'cancelled'],
    production: ['ready_for_delivery'],
    ready_for_delivery: ['completed'],
  };

  app.patch('/operator/orders/:id/status', async (req) => {
    const session = auth(req);
    if (session.user.role !== 'operator') {
      throw error(403, 'FORBIDDEN', 'Только для оператора');
    }
    const id = (req.params as { id: string }).id;
    const body = req.body as { status: string };
    const order = state.orders.get(id);
    if (!order) throw error(404, 'NOT_FOUND', 'Заказ не найден');
    const allowed = transitions[order.status] ?? [];
    if (!allowed.includes(body.status)) {
      throw error(409, 'INVALID_TRANSITION', 'Нельзя так сменить статус');
    }
    order.status = body.status as typeof order.status;
    order.history.push({
      status: order.status,
      at: new Date().toISOString(),
      changedBy: session.user.id,
    });
    return order;
  });

  app.post('/orders/:id/interactions', async (req) => {
    const session = auth(req);
    const id = (req.params as { id: string }).id;
    const order = state.orders.get(id);
    if (!order || order.customerId !== session.user.id) {
      throw error(404, 'NOT_FOUND', 'Заказ не найден');
    }
    const body = req.body as { topic: string; body: string };
    const interaction = {
      id: newId(),
      orderId: id,
      topic: body.topic,
      messages: [
        {
          id: newId(),
          body: body.body,
          authorId: session.user.id,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
    };
    state.interactions.set(interaction.id, interaction);
    return interaction;
  });

  app.post('/interactions/:id/messages', async (req) => {
    const session = auth(req);
    const id = (req.params as { id: string }).id;
    const interaction = state.interactions.get(id);
    if (!interaction) throw error(404, 'NOT_FOUND', 'Обращение не найдено');
    const body = req.body as { body: string };
    const message = {
      id: newId(),
      authorId: session.user.id,
      body: body.body,
      createdAt: new Date().toISOString(),
    };
    interaction.messages.push(message);
    return interaction;
  });

  app.get('/interactions/:id', async (req) => {
    auth(req);
    const id = (req.params as { id: string }).id;
    const interaction = state.interactions.get(id);
    if (!interaction) throw error(404, 'NOT_FOUND', 'Обращение не найдено');
    return interaction;
  });

  app.post('/albums/:id/invite', async (req) => {
    const session = auth(req);
    const id = (req.params as { id: string }).id;
    const album = state.albums.get(id);
    const project = state.projects.get(id);
    if (!album || !project || project.ownerId !== session.user.id) {
      throw error(404, 'NOT_FOUND', 'Альбом не найден');
    }
    const token = newId();
    album.invites.set(token, id);
    return { token, url: `picpac://invite/${token}` };
  });

  app.post('/albums/accept', async (req) => {
    const session = auth(req);
    const body = req.body as { token: string };
    let projectId: string | undefined;
    for (const album of state.albums.values()) {
      if (album.invites.has(body.token)) {
        projectId = album.projectId;
        album.members.add(session.user.id);
        break;
      }
    }
    if (!projectId) throw error(404, 'NOT_FOUND', 'Приглашение не найдено');
    const album = state.albums.get(projectId)!;
    return {
      expected: album.expectedMembers,
      members: [...album.members].map((userId) => ({
        userId,
        childName: null,
        photosCount: [...state.photos.values()].filter(
          (p) => p.projectId === projectId && p.uploadedBy === userId,
        ).length,
      })),
    };
  });

  app.get('/albums/:id/progress', async (req) => {
    auth(req);
    const id = (req.params as { id: string }).id;
    const album = state.albums.get(id);
    if (!album) throw error(404, 'NOT_FOUND', 'Альбом не найден');
    return {
      expected: album.expectedMembers,
      members: [...album.members].map((userId) => ({
        userId,
        childName: null,
        photosCount: [...state.photos.values()].filter(
          (p) => p.projectId === id && p.uploadedBy === userId,
        ).length,
      })),
    };
  });

  app.post('/ai/consent', async (req) => {
    const session = auth(req);
    session.user.aiConsent = true;
    state.users.set(session.user.id, session.user);
    return { ok: true };
  });

  app.post('/ai/edit', async (req) => {
    const session = auth(req);
    if (!session.user.aiConsent) {
      throw error(403, 'AI_CONSENT_REQUIRED', 'Нужно согласие на передачу фото');
    }
    const body = req.body as { prompt?: string; photoId?: string };
    if (body.prompt && /запрещ/i.test(body.prompt)) {
      throw error(422, 'PROMPT_REJECTED', 'Запрос отклонён');
    }
    const job = {
      id: newId(),
      status: 'pending' as const,
    };
    state.aiJobs.set(job.id, job);
    setTimeout(() => {
      const current = state.aiJobs.get(job.id);
      if (!current || current.status !== 'pending') return;
      state.aiJobs.set(job.id, {
        id: job.id,
        status: 'done',
        resultPhoto: {
          id: newId(),
          width: 1600,
          height: 2000,
          takenAt: new Date().toISOString(),
          url: 'https://mock.local/ai-result.jpg',
          uploadedBy: session.user.id,
          source: 'ai',
        },
      });
    }, 300);
    return job;
  });

  app.get('/ai/jobs/:id', async (req) => {
    auth(req);
    const id = (req.params as { id: string }).id;
    const job = state.aiJobs.get(id);
    if (!job) throw error(404, 'NOT_FOUND', 'Задача не найдена');
    return job;
  });

  app.post('/ai/jobs/:id/cancel', async (req) => {
    auth(req);
    const id = (req.params as { id: string }).id;
    const job = state.aiJobs.get(id);
    if (!job) throw error(404, 'NOT_FOUND', 'Задача не найдена');
    if (job.status === 'pending') {
      state.aiJobs.set(id, { id, status: 'failed', reason: 'Отменено пользователем' });
    }
    return state.aiJobs.get(id);
  });

  return app;
}

const port = Number(process.env.PORT ?? 3000);
const app = await buildApp();
await app.listen({ port, host: '0.0.0.0' });
console.log(`mock-api listening on http://localhost:${port}`);
