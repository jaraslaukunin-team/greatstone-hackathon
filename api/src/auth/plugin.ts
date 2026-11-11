import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { jwtVerify, SignJWT } from 'jose';
import type { Role } from '@picpac/shared';
import { audit } from '../audit.js';
import { closeDb, createDb, type Db } from '../db/client.js';
import { profiles } from '../db/schema.js';
import { AppError } from '../errors.js';

export type AuthUser = { id: string; role: Role; guest: boolean };
export type AppClock = { now(): Date };

declare module 'fastify' {
  interface FastifyInstance {
    clock: AppClock;
    db: Db;
  }
  interface FastifyRequest {
    user?: AuthUser;
  }
}

export const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const CODE_TTL_MS = 10 * 60 * 1000;

// Часы приложения: всё, что зависит от времени, читает его только отсюда.
// Подключение к БД ленивое (пул открывает соединение при первом запросе).
export function registerAuth(app: FastifyInstance): void {
  app.decorate('clock', { now: () => new Date() } satisfies AppClock);
  const db = createDb(app.config.databaseUrl);
  app.decorate('db', db);
  app.addHook('onClose', async () => {
    await closeDb(db);
  });
  app.decorateRequest('user', undefined);
}

const key = (app: FastifyInstance) => new TextEncoder().encode(app.config.jwtSecret);

export async function signToken(app: FastifyInstance, user: AuthUser): Promise<string> {
  const iat = Math.floor(app.clock.now().getTime() / 1000);
  return new SignJWT({ role: user.role, guest: user.guest })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt(iat)
    .setExpirationTime(iat + TOKEN_TTL_SECONDS)
    .sign(key(app));
}

export function hashCode(app: FastifyInstance, contact: string, code: string): string {
  return createHmac('sha256', app.config.jwtSecret).update(`${contact}\n${code}`).digest('hex');
}

export function hashesEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const unauthorized = () => new AppError(401, 'UNAUTHORIZED', 'Требуется вход в приложение');

export async function requireAuth(req: FastifyRequest, _reply?: FastifyReply): Promise<void> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw unauthorized();
  let sub: string | undefined;
  try {
    const { payload } = await jwtVerify(token, key(req.server), {
      algorithms: ['HS256'],
      currentDate: req.server.clock.now(),
    });
    sub = payload.sub;
  } catch {
    throw unauthorized();
  }
  if (!sub || !/^[0-9a-f-]{36}$/i.test(sub)) throw unauthorized();
  const [p] = await req.server.db.select().from(profiles).where(eq(profiles.id, sub));
  if (!p) throw unauthorized();
  req.user = { id: p.id, role: p.role, guest: p.isGuest };
}

export function requireRole(role: Role) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await requireAuth(req, reply);
    const user = req.user!;
    if (user.role !== role) {
      await audit(req.server.db, {
        userId: user.id,
        action: 'access.denied',
        objectType: 'route',
        objectId: null,
        result: 'denied',
      });
      throw new AppError(403, 'FORBIDDEN', 'Недостаточно прав для этого действия');
    }
  };
}

// Чужой объект: пишем отказ в журнал и отвечаем 404, чтобы не раскрывать существование.
// Запись в журнал асинхронна, поэтому тип Promise<never>: вызывать как await deny(...).
export async function deny(req: FastifyRequest, objectType: string, objectId: string): Promise<never> {
  await audit(req.server.db, {
    userId: req.user?.id ?? null,
    action: 'access.denied',
    objectType,
    objectId,
    result: 'denied',
  });
  throw new AppError(404, 'NOT_FOUND', 'Объект не найден');
}
