import { count, eq, lt } from 'drizzle-orm';
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
    expect(await db.select().from(s.promoCodes).where(lt(s.promoCodes.discountPercent, 100))).toHaveLength(3);

    const statuses = new Set((await db.select().from(s.orders)).map((o) => o.status));
    expect(statuses.size).toBeGreaterThanOrEqual(4);
    const numbers = (await db.select().from(s.orders)).map((o) => o.number);
    for (const n of numbers) expect(n).toMatch(/^PP-\d{6}$/);
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
});
