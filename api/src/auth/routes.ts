import { randomInt } from 'node:crypto';
import { and, count, desc, eq, gt, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { UserDTO } from '@picpac/shared';
import { audit } from '../audit.js';
import { auditLog, authCodes, consents, profiles } from '../db/schema.js';
import { AppError } from '../errors.js';
import { parse } from '../validation.js';
import { CODE_TTL_MS, hashCode, hashesEqual, requireAuth, signToken } from './plugin.js';

const DEMO_CODE = '000000';

// Окно и лимиты: неверных кодов 5 и запросов кода 3 за 10 минут на контакт. Счёт идёт по журналу,
// ключ — HMAC контакта, поэтому телефон или почта в журнал открытым текстом не попадают.
const RATE_WINDOW_MS = 10 * 60 * 1000;
// Основной лимит считается на пару «контакт + адрес»: посторонний не заблокирует чужой вход со своего адреса.
// Общий лимит на контакт выше и останавливает перебор с множества адресов.
const CODE_FAIL_LIMIT = 5;
const CODE_FAIL_LIMIT_ANY_IP = 30;
const CODE_REQUEST_LIMIT = 3;
const CODE_REQUEST_LIMIT_ANY_IP = 10;
const tooMany = () => new AppError(429, 'TOO_MANY_ATTEMPTS', 'Слишком много попыток. Подождите 10 минут и попробуйте снова');

async function recentCount(app: FastifyInstance, action: string, key: string): Promise<number> {
  const since = new Date(app.clock.now().getTime() - RATE_WINDOW_MS);
  const [{ n }] = (await app.db
    .select({ n: count() })
    .from(auditLog)
    .where(and(eq(auditLog.action, action), eq(auditLog.objectId, key), gt(auditLog.at, since)))) as [{ n: number }];
  return n;
}

const note = (app: FastifyInstance, action: string, key: string, result: 'ok' | 'denied') =>
  audit(app.db, { userId: null, action, objectType: 'contact', objectId: key, result, at: app.clock.now() });

// Ключи считаются HMAC: ни контакт, ни адрес в журнал открытым текстом не попадают.
const keysOf = (app: FastifyInstance, contact: string, ip: string) => ({
  contact: hashCode(app, contact, 'rate-limit'),
  pair: hashCode(app, contact, `rate-limit|${ip}`),
});

const contactSchema = z.string().trim().toLowerCase().min(3).max(200);
const requestCodeSchema = z.object({ contact: contactSchema });
const verifyCodeSchema = z.object({ contact: contactSchema, code: z.string().trim().regex(/^\d{6}$/) });

type Profile = typeof profiles.$inferSelect;

async function toUserDTO(app: FastifyInstance, p: Profile): Promise<UserDTO> {
  const [consent] = await app.db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.userId, p.id), eq(consents.kind, 'ai_processing')));
  return { id: p.id, role: p.role, displayName: p.displayName, isGuest: p.isGuest, aiConsent: !!consent };
}

async function login(app: FastifyInstance, p: Profile) {
  await audit(app.db, { userId: p.id, action: 'auth.login', objectType: 'profile', objectId: p.id, result: 'ok' });
  const token = await signToken(app, { id: p.id, role: p.role, guest: p.isGuest });
  return { token, user: await toUserDTO(app, p) };
}

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post('/auth/guest', async () => {
    const [p] = await app.db
      .insert(profiles)
      .values({ role: 'customer', displayName: 'Гость', isGuest: true })
      .returning();
    return login(app, p!);
  });

  app.post('/auth/request-code', async (req, reply) => {
    const { contact } = parse(requestCodeSchema, req.body);
    const k = keysOf(app, contact, req.ip);
    if (
      (await recentCount(app, 'auth.code_requested', k.pair)) >= CODE_REQUEST_LIMIT ||
      (await recentCount(app, 'auth.code_requested', k.contact)) >= CODE_REQUEST_LIMIT_ANY_IP
    ) {
      throw tooMany();
    }
    await note(app, 'auth.code_requested', k.pair, 'ok');
    await note(app, 'auth.code_requested', k.contact, 'ok');
    const code = app.config.demoMode ? DEMO_CODE : String(randomInt(0, 1_000_000)).padStart(6, '0');
    await app.db.insert(authCodes).values({
      contact,
      codeHash: hashCode(app, contact, code),
      expiresAt: new Date(app.clock.now().getTime() + CODE_TTL_MS),
    });
    // Отправки SMS и писем нет: вне демо-режима код виден только в логе приложения.
    if (!app.config.demoMode) req.log.info({ contact, code }, 'login code issued');
    return reply.status(204).send();
  });

  app.post('/auth/verify-code', async (req) => {
    const { contact, code } = parse(verifyCodeSchema, req.body);
    const k = keysOf(app, contact, req.ip);
    // Демо-код остаётся рабочим даже после блокировки: он нужен для показа и не угадывается перебором.
    const demoLogin = app.config.demoMode && code === DEMO_CODE;
    if (
      !demoLogin &&
      ((await recentCount(app, 'auth.code_failed', k.pair)) >= CODE_FAIL_LIMIT ||
        (await recentCount(app, 'auth.code_failed', k.contact)) >= CODE_FAIL_LIMIT_ANY_IP)
    ) {
      throw tooMany();
    }
    const candidates = await app.db
      .select()
      .from(authCodes)
      .where(and(eq(authCodes.contact, contact), isNull(authCodes.usedAt)))
      .orderBy(desc(authCodes.createdAt));
    const expected = hashCode(app, contact, code);
    const match = candidates.find((c) => hashesEqual(c.codeHash, expected));
    if (!match) {
      await note(app, 'auth.code_failed', k.pair, 'denied');
      await note(app, 'auth.code_failed', k.contact, 'denied');
      throw new AppError(401, 'CODE_INVALID', 'Неверный код, проверьте его и попробуйте снова');
    }
    if (match.expiresAt.getTime() <= app.clock.now().getTime()) {
      throw new AppError(401, 'CODE_EXPIRED', 'Срок действия кода истёк, запросите новый');
    }
    const used = await app.db
      .update(authCodes)
      .set({ usedAt: app.clock.now() })
      .where(and(eq(authCodes.id, match.id), isNull(authCodes.usedAt)))
      .returning({ id: authCodes.id });
    if (used.length === 0) throw new AppError(401, 'CODE_INVALID', 'Этот код уже использован, запросите новый');

    await app.db
      .insert(profiles)
      .values({ role: 'customer', displayName: contact.split('@')[0] || contact, isGuest: false, contact })
      .onConflictDoNothing({ target: profiles.contact });
    const [p] = await app.db.select().from(profiles).where(eq(profiles.contact, contact));
    return login(app, p!);
  });

  app.get('/me', { preHandler: requireAuth }, async (req) => {
    const [p] = await app.db.select().from(profiles).where(eq(profiles.id, req.user!.id));
    return toUserDTO(app, p!);
  });
}
