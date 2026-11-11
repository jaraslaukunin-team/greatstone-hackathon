import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { AiChatMessage, AiChatResponse } from '@picpac/shared';
import { audit } from '../../audit.js';
import type { AuthUser } from '../../auth/plugin.js';
import { orders, productVariants, products } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { formatByn } from '@picpac/shared';

export async function chatAssist(
  app: FastifyInstance,
  user: AuthUser,
  input: { messages: AiChatMessage[]; orderId?: string },
): Promise<AiChatResponse> {
  if (user.role === 'operator') {
    throw new AppError(403, 'FORBIDDEN', 'Чат ассистента доступен клиентам');
  }

  const last = input.messages.at(-1);
  if (!last || last.role !== 'user') {
    throw new AppError(422, 'INVALID_MESSAGES', 'Последнее сообщение должно быть от пользователя');
  }

  const catalogRows = await app.db
    .select({
      title: products.title,
      kind: products.kind,
      format: productVariants.format,
      basePriceKop: productVariants.basePrice,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .limit(24);

  const catalogLines = catalogRows
    .map((r) => `- ${r.title} (${r.kind}, ${r.format}): от ${formatByn(r.basePriceKop)}`)
    .join('\n');

  const recentOrders = await app.db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      totalKop: orders.total,
    })
    .from(orders)
    .where(eq(orders.customerId, user.id))
    .orderBy(desc(orders.createdAt))
    .limit(8);

  let orderExtra = '';
  if (input.orderId) {
    const [focused] = await app.db
      .select()
      .from(orders)
      .where(and(eq(orders.id, input.orderId), eq(orders.customerId, user.id)));
    if (!focused) {
      throw new AppError(404, 'NOT_FOUND', 'Заказ не найден');
    }
    orderExtra = `\nСейчас пользователь спрашивает про заказ ${focused.number}, статус ${focused.status}, сумма ${formatByn(focused.total)}.`;
  }

  const ordersLines =
    recentOrders.length === 0
      ? 'Заказов пока нет.'
      : recentOrders
          .map((o) => `- ${o.number}: ${o.status}, ${formatByn(o.totalKop)}`)
          .join('\n');

  const system = [
    'Ты — текстовый ассистент интернет-магазина фотопродукции picPac (Беларусь, BYN).',
    'Помогай отслеживать заказы, предлагать товары из каталога и консультировать по доставке.',
    'Не выдумывай цены и статусы: опирайся только на данные ниже.',
    'Отвечай по-русски, кратко и дружелюбно. Не проси API-ключи и не обсуждай внутреннюю реализацию.',
    '',
    'Каталог (фрагмент):',
    catalogLines || 'Каталог пуст.',
    '',
    'Заказы пользователя:',
    ordersLines,
    orderExtra,
  ].join('\n');

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
      objectType: 'profile',
      objectId: user.id,
      result: 'ok',
    });
    const messages: AiChatMessage[] = [...input.messages, { role: 'assistant', content: reply }];
    return { reply, messages };
  } catch (e) {
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
