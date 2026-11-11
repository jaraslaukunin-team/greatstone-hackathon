import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../src/db/client.js';
import * as s from '../src/db/schema.js';
import { seedDatabase } from '../src/db/seed.js';
import { testApp } from './helpers.js';

describe('seedDatabase', () => {
  let app: FastifyInstance;
  let db: Db;
  let reset: () => Promise<void>;

  beforeAll(async () => {
    ({ app, db, reset } = await testApp());
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await reset();
  });

  it('создаёт каталог, пользователей, промокоды, заказы и обращения', async () => {
    const summary = await seedDatabase(db);
    expect(summary.products).toBe(6);
    expect(summary.variants).toBeGreaterThanOrEqual(12);
    expect(summary.orders).toBe(5);
    expect(summary.interactions).toBe(2);

    const variants = await db.select().from(s.productVariants);
    for (const v of variants) {
      expect(v.pageWidthCm).toBeGreaterThan(0);
      expect(v.minDpi).toBe(150);
    }
    const classic = variants.find((v) => v.format === 'Classic 20×20');
    expect(classic).toMatchObject({
      basePrice: 8100,
      pricePerPage: 150,
      pagesMin: 20,
      pagesMax: 60,
      pageWidthCm: 20,
      minDpi: 150,
    });

    const roles = (await db.select().from(s.profiles)).map((p) => p.role);
    expect(roles).toContain('customer');
    expect(roles).toContain('operator');

    const [old] = await db.select().from(s.promoCodes).where(eq(s.promoCodes.code, 'OLD20'));
    expect(old!.validUntil.getTime()).toBeLessThan(Date.now());
    const promos = await db.select().from(s.promoCodes);
    expect(promos).toHaveLength(3);
    const percent = (code: string) => promos.find((p) => p.code === code)?.discountPercent;
    expect(percent('HELLO10')).toBe(10);
    expect(percent('SCHOOL15')).toBe(15);
    expect(percent('OLD20')).toBe(20);

    const contacts = (await db.select().from(s.profiles)).map((p) => p.contact).sort();
    expect(contacts).toEqual(['customer1@test.local', 'customer2@test.local', 'operator@test.local']);

    const statuses = new Set((await db.select().from(s.orders)).map((o) => o.status));
    expect(statuses.size).toBeGreaterThanOrEqual(4);
    const numbers = (await db.select().from(s.orders)).map((o) => o.number);
    for (const n of numbers) expect(n).toMatch(/^PP-\d{6}$/);
  });

  it('reset() сбрасывает последовательность номеров заказов', async () => {
    await seedDatabase(db);
    await reset();
    await seedDatabase(db);
    const numbers = (await db.select().from(s.orders)).map((o) => o.number);
    expect(numbers).toContain('PP-000001');
    expect(numbers).toHaveLength(5);
  });

  it('база отклоняет отрицательные цены и скидку больше 100%', async () => {
    await seedDatabase(db);
    const [v] = await db.select().from(s.productVariants);
    const { id: _id, ...variant } = v!;
    const code = (e: unknown) => (e as { code?: string }).code;
    for (const bad of [{ basePrice: -1 }, { pricePerPage: -1 }, { minDpi: 0 }, { pagesMin: -1 }, { pageWidthCm: 0 }]) {
      const err = await db.insert(s.productVariants).values({ ...variant, ...bad }).catch((e) => e);
      expect(code(err)).toBe('23514');
    }
    const promo = { code: 'BAD', validUntil: new Date() };
    for (const discountPercent of [101, -1]) {
      const err = await db.insert(s.promoCodes).values({ ...promo, discountPercent }).catch((e) => e);
      expect(code(err)).toBe('23514');
    }
    const [o] = await db.select().from(s.orders);
    const { id: _oid, number: _n, ...order } = o!;
    const err = await db.insert(s.orders).values({ ...order, idempotencyKey: 'neg', total: -1 }).catch((e) => e);
    expect(code(err)).toBe('23514');
    const [p] = await db.select().from(s.projects);
    const { id: _pid, ...project } = p!;
    const err2 = await db.insert(s.projects).values({ ...project, expectedMembers: -1 }).catch((e) => e);
    expect(code(err2)).toBe('23514');
  });

  it('повторный вызов не меняет число строк', async () => {
    await seedDatabase(db);
    const tables = [s.profiles, s.products, s.productVariants, s.promoCodes, s.projects, s.orders,
      s.orderStatusHistory, s.interactions, s.interactionMessages];
    const counts = async () =>
      Promise.all(tables.map(async (t) => (await db.select({ n: count() }).from(t))[0]!.n));
    const first = await counts();
    await seedDatabase(db);
    expect(await counts()).toEqual(first);
  });

  it('повторный вызов исправляет устаревший каталог: цены, страницы, описания и срок промокода', async () => {
    await seedDatabase(db);
    // Так выглядит база, засеянная старой версией сида: печать с pages_min 10 и нулевой базой.
    await db.update(s.productVariants).set({ pagesMin: 10, basePrice: 0 }).where(eq(s.productVariants.format, '10×15 глянцевая'));
    await db.update(s.products).set({ description: '', leadTimeDays: 99 }).where(eq(s.products.title, 'Печать 10×15'));
    await db.update(s.promoCodes).set({ discountPercent: 1 }).where(eq(s.promoCodes.code, 'HELLO10'));

    await seedDatabase(db);

    const [variant] = await db.select().from(s.productVariants).where(eq(s.productVariants.format, '10×15 глянцевая'));
    expect(variant).toMatchObject({ pagesMin: 1, basePrice: 61, pricePerPage: 61 });
    const [product] = await db.select().from(s.products).where(eq(s.products.title, 'Печать 10×15'));
    expect(product!.leadTimeDays).toBe(2);
    expect(product!.description.length).toBeGreaterThan(0);
    const [promo] = await db.select().from(s.promoCodes).where(eq(s.promoCodes.code, 'HELLO10'));
    expect(promo!.discountPercent).toBe(10);
  });

  it('повторный вызов не затирает данные пользователей: статус заказа остаётся, каким его изменили', async () => {
    await seedDatabase(db);
    const [order] = await db.select().from(s.orders).where(eq(s.orders.status, 'accepted')).limit(1);
    await db.update(s.orders).set({ status: 'completed' }).where(eq(s.orders.id, order!.id));
    await seedDatabase(db);
    const [after] = await db.select().from(s.orders).where(eq(s.orders.id, order!.id));
    expect(after!.status).toBe('completed');
  });
});
