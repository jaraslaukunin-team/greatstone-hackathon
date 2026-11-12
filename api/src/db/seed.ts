import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { count, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { closeDb, createDb, type Db } from './client.js';
import * as s from './schema.js';

export type SeedSummary = {
  profiles: number;
  products: number;
  variants: number;
  promoCodes: number;
  projects: number;
  orders: number;
  orderStatusHistory: number;
  interactions: number;
  interactionMessages: number;
};

// Фиксированные UUID: повторный запуск сида находит те же строки и ничего не дублирует.
const uid = (ns: number, n: number) =>
  `${ns.toString(16).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const NS = { profile: 1, product: 2, variant: 3, project: 4, order: 5, history: 6, interaction: 7, message: 8, promo: 9 };

const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const days = (n: number) => new Date(Date.UTC(2026, 10, 1) + n * 86_400_000);

const CUSTOMER1 = uid(NS.profile, 1);
const CUSTOMER2 = uid(NS.profile, 2);
const OPERATOR = uid(NS.profile, 3);

type VariantSeed = [format: string, pagesMin: number, pagesMax: number, base: number, perPage: number, widthCm: number];
type ProductSeed = { kind: 'photobook' | 'prints' | 'graduation'; line: 'photo' | 'digital' | null; title: string; description: string; lead: number; variants: VariantSeed[] };

// Цены в копейках, выдуманные, но правдоподобные.
// Каталог и промокоды при повторном запуске обновляются (чтобы старая база получила исправления),
// пользователи, проекты, заказы и обращения существующие строки не меняют.
const PRODUCTS: ProductSeed[] = [
  { kind: 'photobook', line: null, title: 'Фотокнига Lite', description: 'Твёрдая обложка и гибкие журнальные страницы. Подходит, когда фото много.', lead: 5, variants: [
    ['Lite 15×15', 20, 40, 7000, 100, 15],
    ['Lite 20×20', 20, 40, 7900, 120, 20],
  ] },
  { kind: 'photobook', line: null, title: 'Фотокнига Classic', description: 'Плотные страницы, разворот раскрывается на 180° без шва по центру.', lead: 7, variants: [
    ['Classic 15×15', 20, 60, 6500, 130, 15],
    ['Classic 20×20', 20, 60, 8100, 150, 20],
    ['Classic 20×30', 20, 60, 9800, 190, 20],
  ] },
  { kind: 'photobook', line: null, title: 'Фотокнига Premium', description: 'Печать на матовой фотобумаге, плотные развороты и твёрдая обложка.', lead: 10, variants: [
    ['Premium 20×20', 20, 80, 10050, 200, 20],
    ['Premium 20×30', 20, 80, 12500, 250, 20],
    ['Premium 30×30', 20, 80, 15000, 320, 30],
  ] },
  { kind: 'graduation', line: null, title: 'Выпускной альбом', description: 'Книга выпуска: личные страницы учеников и общие развороты класса.', lead: 14, variants: [
    ['Выпускной 20×20', 12, 40, 9000, 180, 20],
    ['Выпускной 20×30', 12, 40, 11500, 230, 20],
  ] },
  { kind: 'prints', line: 'photo', title: 'Печать 10×15', description: 'Классические отпечатки 10×15 см, от одного кадра.', lead: 2, variants: [
    ['10×15 матовая', 1, 500, 61, 61, 10],
    ['10×15 глянцевая', 1, 500, 61, 61, 10],
  ] },
  { kind: 'prints', line: 'photo', title: 'Печать 15×20', description: 'Крупные отпечатки 15×20 см для рамок и подарков.', lead: 2, variants: [
    ['15×20 матовая', 1, 300, 150, 150, 15],
    ['15×20 глянцевая', 1, 300, 150, 150, 15],
  ] },
  { kind: 'prints', line: 'digital', title: 'Цифровая печать', description: 'Открытки и постеры: печать файла без исходной плёнки, яркие цвета на матовой бумаге.', lead: 3, variants: [
    ['Открытка 10×15', 1, 500, 150, 150, 10],
    ['Постер 30×40', 1, 100, 1200, 1200, 30],
    ['Постер 40×60', 1, 100, 1900, 1900, 40],
  ] },
];

type OrderStatus = (typeof s.orderStatusEnum.enumValues)[number];
type OrderSeed = {
  customer: string;
  variant: string; // формат варианта
  status: OrderStatus;
  total: number;
  delivery: 'courier_minsk' | 'ems' | 'belpost';
  trail: OrderStatus[];
};

const ORDERS: OrderSeed[] = [
  { customer: CUSTOMER1, variant: 'Classic 20×20', status: 'accepted', total: 11100, delivery: 'courier_minsk', trail: ['accepted'] },
  { customer: CUSTOMER1, variant: 'Lite 15×15', status: 'moderation', total: 9000, delivery: 'ems', trail: ['accepted', 'moderation'] },
  { customer: CUSTOMER2, variant: 'Premium 20×20', status: 'production', total: 14050, delivery: 'belpost', trail: ['accepted', 'moderation', 'production'] },
  { customer: CUSTOMER2, variant: 'Выпускной 20×20', status: 'completed', total: 15000, delivery: 'courier_minsk', trail: ['accepted', 'moderation', 'production', 'ready_for_delivery', 'completed'] },
  { customer: CUSTOMER1, variant: '10×15 матовая', status: 'cancelled', total: 1830, delivery: 'belpost', trail: ['accepted', 'cancelled'] },
];

export async function seedDatabase(db: Db): Promise<SeedSummary> {
  await db
    .insert(s.profiles)
    .values([
      { id: CUSTOMER1, role: 'customer', displayName: 'Анна Тестова', contact: 'customer1@test.local' },
      { id: CUSTOMER2, role: 'customer', displayName: 'Иван Образцов', contact: 'customer2@test.local' },
      { id: OPERATOR, role: 'operator', displayName: 'Оператор Тестовый', contact: 'operator@test.local' },
    ])
    .onConflictDoNothing();

  const variantIds = new Map<string, string>();
  let productNo = 0;
  let variantNo = 0;
  for (const p of PRODUCTS) {
    const productId = uid(NS.product, ++productNo);
    await db
      .insert(s.products)
      .values({ id: productId, kind: p.kind, line: p.line, title: p.title, description: p.description, leadTimeDays: p.lead })
      .onConflictDoUpdate({
        target: s.products.id,
        set: { kind: p.kind, line: p.line, title: p.title, description: p.description, leadTimeDays: p.lead },
      });
    for (const [format, pagesMin, pagesMax, basePrice, pricePerPage, pageWidthCm] of p.variants) {
      const id = uid(NS.variant, ++variantNo);
      variantIds.set(format, id);
      await db
        .insert(s.productVariants)
        .values({ id, productId, format, pagesMin, pagesMax, basePrice, pricePerPage, pageWidthCm, minDpi: 150 })
        .onConflictDoUpdate({
          target: s.productVariants.id,
          set: { productId, format, pagesMin, pagesMax, basePrice, pricePerPage, pageWidthCm, minDpi: 150 },
        });
    }
  }

  await db
    .insert(s.promoCodes)
    .values([
      { id: uid(NS.promo, 1), code: 'HELLO10', discountPercent: 10, validUntil: new Date('2030-12-31T23:59:59Z') },
      { id: uid(NS.promo, 2), code: 'SCHOOL15', discountPercent: 15, validUntil: new Date('2030-12-31T23:59:59Z') },
      { id: uid(NS.promo, 3), code: 'OLD20', discountPercent: 20, validUntil: new Date('2025-01-01T00:00:00Z') },
    ])
    .onConflictDoUpdate({
      target: s.promoCodes.id,
      set: {
        code: sql`excluded.code`,
        discountPercent: sql`excluded.discount_percent`,
        validUntil: sql`excluded.valid_until`,
      },
    });

  let historyNo = 0;
  for (const [i, o] of ORDERS.entries()) {
    const n = i + 1;
    const projectId = uid(NS.project, n);
    const orderId = uid(NS.order, n);
    await db
      .insert(s.projects)
      .values({ id: projectId, ownerId: o.customer, variantId: variantIds.get(o.variant)!, status: 'ordered' })
      .onConflictDoNothing();
    await db
      .insert(s.orders)
      .values({
        id: orderId,
        customerId: o.customer,
        projectId,
        idempotencyKey: `seed-order-${n}`,
        requestHash: hash(`seed-order-${n}`),
        total: o.total,
        deliveryMethod: o.delivery,
        recipientName: o.customer === CUSTOMER1 ? 'Анна Тестова' : 'Иван Образцов',
        address: 'г. Минск, ул. Тестовая, 1, кв. 1',
        status: o.status,
        createdAt: days(i),
      })
      .onConflictDoNothing();
    for (const [k, status] of o.trail.entries()) {
      await db
        .insert(s.orderStatusHistory)
        .values({
          id: uid(NS.history, ++historyNo),
          orderId,
          status,
          changedBy: status === 'accepted' || status === 'cancelled' ? o.customer : OPERATOR,
          changedAt: days(i + k),
          comment: status === 'cancelled' ? 'Отмена клиентом' : null,
        })
        .onConflictDoNothing();
    }
  }

  await db
    .insert(s.interactions)
    .values([
      { id: uid(NS.interaction, 1), orderId: uid(NS.order, 3), customerId: CUSTOMER2, topic: 'Сроки печати', status: 'answered', createdAt: days(3) },
      { id: uid(NS.interaction, 2), orderId: uid(NS.order, 1), customerId: CUSTOMER1, topic: 'Изменить адрес доставки', status: 'open', createdAt: days(4) },
    ])
    .onConflictDoNothing();
  await db
    .insert(s.interactionMessages)
    .values([
      { id: uid(NS.message, 1), interactionId: uid(NS.interaction, 1), authorId: CUSTOMER2, body: 'Когда будет готов мой заказ?', createdAt: days(3) },
      { id: uid(NS.message, 2), interactionId: uid(NS.interaction, 1), authorId: OPERATOR, body: 'Заказ в производстве, срок до 10 дней.', createdAt: days(4) },
      { id: uid(NS.message, 3), interactionId: uid(NS.interaction, 2), authorId: CUSTOMER1, body: 'Можно изменить адрес доставки?', createdAt: days(4) },
    ])
    .onConflictDoNothing();

  const total = async (t: PgTable) => (await db.select({ n: count() }).from(t))[0]!.n;
  return {
    profiles: await total(s.profiles),
    products: await total(s.products),
    variants: await total(s.productVariants),
    promoCodes: await total(s.promoCodes),
    projects: await total(s.projects),
    orders: await total(s.orders),
    orderStatusHistory: await total(s.orderStatusHistory),
    interactions: await total(s.interactions),
    interactionMessages: await total(s.interactionMessages),
  };
}

// Запуск из командной строки: npm run db:seed -w api
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Не задана переменная окружения DATABASE_URL');
  const db = createDb(url);
  try {
    console.log('Сид выполнен:', await seedDatabase(db));
  } finally {
    await closeDb(db);
  }
}
