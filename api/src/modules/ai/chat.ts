import { createHash } from 'node:crypto';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AiChatMessage, AiChatResponse } from '@picpac/shared';
import { formatByn } from '@picpac/shared';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import { auditLog, consents, orders, productVariants, products } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { AI_HOURLY_LIMIT } from './service.js';
import { isPromptAllowed } from './promptFilter.js';

const HOUR_MS = 60 * 60 * 1000;

function wantsCatalog(text: string): boolean {
  return /каталог|цен|стоим|книг|печат|услуг|товар|фотокниг|альбом|формат/i.test(text);
}

function wantsOrders(text: string): boolean {
  return /заказ|статус|где|доставк|когда|готов/i.test(text);
}

export async function chatAssist(
  app: FastifyInstance,
  user: AuthUser,
  input: { messages: AiChatMessage[]; orderId?: string },
): Promise<AiChatResponse> {
  if (user.role === 'operator') {
    throw new AppError(403, 'FORBIDDEN', 'Чат ассистента доступен клиентам');
  }

  const [consent] = await app.db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.userId, user.id), eq(consents.kind, 'ai_processing')));
  if (!consent) {
    throw new AppError(
      403,
      'AI_CONSENT_REQUIRED',
      'Перед чатом нужно согласие на передачу сообщений во внешний сервис (aiai.by)',
    );
  }

  const last = input.messages.at(-1);
  if (!last || last.role !== 'user') {
    throw new AppError(422, 'INVALID_MESSAGES', 'Последнее сообщение должно быть от пользователя');
  }
  if (!isPromptAllowed(last.content)) {
    throw new AppError(422, 'PROMPT_REJECTED', 'Такой запрос обработать нельзя. Сформулируйте иначе');
  }

  const now = app.clock.now();
  await app.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ai-chat:${user.id}`}))`);
    const [{ n }] = (await tx
      .select({ n: count() })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.userId, user.id),
          eq(auditLog.action, 'ai.chat'),
          eq(auditLog.result, 'ok'),
          gte(auditLog.at, new Date(now.getTime() - HOUR_MS)),
        ),
      )) as [{ n: number }];
    if (n >= AI_HOURLY_LIMIT) {
      throw new AppError(
        429,
        'AI_LIMIT',
        `Можно отправить не больше ${AI_HOURLY_LIMIT} сообщений ассистенту в час. Попробуйте позже`,
      );
    }
  });

  const askCatalog = wantsCatalog(last.content);
  const askOrders = wantsOrders(last.content) || Boolean(input.orderId);

  let catalogBlock = 'Каталог не запрошен — уточните у пользователя, что показать.';
  if (askCatalog) {
    const catalogRows = await app.db
      .select({
        title: products.title,
        kind: products.kind,
        format: productVariants.format,
        basePriceKop: productVariants.basePrice,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .limit(16);
    catalogBlock =
      catalogRows.length === 0
        ? 'Каталог пуст.'
        : catalogRows
            .map((r) => `- ${r.title} (${r.kind}, ${r.format}): от ${formatByn(r.basePriceKop)}`)
            .join('\n');
  }

  let ordersBlock = 'Заказы не запрошены.';
  if (askOrders) {
    const recentOrders = await app.db
      .select({
        number: orders.number,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.customerId, user.id))
      .orderBy(desc(orders.createdAt))
      .limit(8);
    ordersBlock =
      recentOrders.length === 0
        ? 'Заказов пока нет.'
        : recentOrders.map((o) => `- ${o.number}: ${o.status}`).join('\n');
  }

  let orderExtra = '';
  if (input.orderId) {
    const [focused] = await app.db
      .select({ number: orders.number, status: orders.status })
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.customerId, user.id)));
    if (!focused) {
      throw new AppError(404, 'NOT_FOUND', 'Заказ не найден');
    }
    orderExtra = `\nСейчас пользователь спрашивает про заказ ${focused.number}, статус ${focused.status}.`;
  }

  const system = [
    'Ты — текстовый ассистент интернет-магазина фотопродукции picPac (Беларусь, BYN).',
    'Помогай отслеживать заказы, предлагать товары из каталога и консультировать по доставке.',
    'Не выдумывай цены и статусы: опирайся только на данные ниже. Не проси и не раскрывай персональные данные сверх необходимого.',
    'Отвечай по-русски, кратко и дружелюбно. Не проси API-ключи и не обсуждай внутреннюю реализацию.',
    '',
    'Каталог:',
    catalogBlock,
    '',
    'Заказы пользователя:',
    ordersBlock,
    orderExtra,
  ].join('\n');

  const messageHash = createHash('sha256').update(last.content, 'utf8').digest('hex');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const reply = await app.ai.chat.complete({
      system,
      messages: input.messages,
      signal: controller.signal,
    });
    await audit(app.db, {
      userId: user.id,
      action: 'ai.chat',
      objectType: 'message',
      objectId: messageHash,
      result: 'ok',
      at: now,
    });
    await audit(app.db, {
      userId: user.id,
      action: 'ai.egress',
      objectType: 'chat',
      objectId: messageHash,
      result: 'ok',
      at: now,
    });
    const messages: AiChatMessage[] = [...input.messages, { role: 'assistant', content: reply }];
    return { reply, messages };
  } catch (e) {
    if (e instanceof AppError) throw e;
    app.log.error(e, 'сбой AI-чата');
    throw new AppError(
      503,
      'AI_UNAVAILABLE',
      controller.signal.aborted
        ? 'Ассистент не ответил вовремя, попробуйте ещё раз'
        : 'Ассистент временно недоступен, попробуйте ещё раз',
    );
  } finally {
    clearTimeout(timer);
  }
}
