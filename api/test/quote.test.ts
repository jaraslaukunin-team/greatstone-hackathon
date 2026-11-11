import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { quoteResponseSchema } from '@picpac/shared';
import { productVariants } from '../src/db/schema.js';
import { seed, testApp } from './helpers.js';

describe('расчёт цены по запросу', () => {
  let app: FastifyInstance;
  let db: Awaited<ReturnType<typeof testApp>>['db'];
  let reset: () => Promise<void>;
  let token: string;
  let classicId: string;
  let printsId: string;

  beforeAll(async () => {
    ({ app, db, reset } = await testApp());
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => new Date('2026-11-11T12:00:00Z');
    token = ((await app.inject({ method: 'POST', url: '/auth/guest' })).json() as { token: string }).token;
    const variant = async (format: string) =>
      (await db.select().from(productVariants).where(eq(productVariants.format, format)))[0]!.id;
    classicId = await variant('Classic 20×20');
    printsId = await variant('10×15 глянцевая');
  });

  const quote = (body: Record<string, unknown>, withToken = true) =>
    app.inject({
      method: 'POST',
      url: '/price-quote',
      payload: body,
      headers: withToken ? { authorization: `Bearer ${token}` } : {},
    });
  const base = () => ({ variantId: classicId, pages: 20, quantity: 1, delivery: 'belpost' });

  it('Classic 30 страниц, 2 шт., " hello10 ", Белпочта: итого 17280 и промокод применён', async () => {
    const res = await quote({ ...base(), pages: 30, quantity: 2, promoCode: ' hello10 ' });
    expect(res.statusCode).toBe(200);
    const body = quoteResponseSchema.parse(res.json());
    expect(body).toEqual({
      itemsKop: 19200,
      discountKop: 1920,
      deliveryKop: 0,
      totalKop: 17280,
      currency: 'BYN',
      promoApplied: true,
    });
  });

  it('запрос без промокода считается: Classic 20 страниц, Белпочта, итого 8790', async () => {
    const res = await quote(base());
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ itemsKop: 8100, deliveryKop: 690, totalKop: 8790, promoApplied: false });
  });

  it('пустой и состоящий из пробелов промокод не считается промокодом', async () => {
    for (const promoCode of ['', '   ']) {
      const res = await quote({ ...base(), promoCode });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ totalKop: 8790, promoApplied: false });
    }
  });

  it('округление копеек: 25 страниц, SCHOOL15, курьер даёт скидку 1328 и итог 7522', async () => {
    const res = await quote({ ...base(), pages: 25, promoCode: 'school15', delivery: 'courier_minsk' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toMatchObject({ itemsKop: 8850, discountKop: 1328, deliveryKop: 0, totalKop: 7522 });
    for (const k of ['itemsKop', 'discountKop', 'deliveryKop', 'totalKop']) {
      expect(Number.isInteger(body[k])).toBe(true);
    }
  });

  it('просроченный промокод OLD20: 422 PROMO_EXPIRED, неизвестный XXX: 422 PROMO_UNKNOWN', async () => {
    const expired = await quote({ ...base(), promoCode: 'OLD20' });
    expect(expired.statusCode).toBe(422);
    expect(expired.json().error.code).toBe('PROMO_EXPIRED');
    const unknown = await quote({ ...base(), promoCode: 'XXX' });
    expect(unknown.statusCode).toBe(422);
    expect(unknown.json().error.code).toBe('PROMO_UNKNOWN');
  });

  it('срок промокода проверяется по часам приложения, а не по системным', async () => {
    app.clock.now = () => new Date('2024-06-01T00:00:00Z');
    const res = await quote({ ...base(), promoCode: 'OLD20' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ promoApplied: true, discountKop: 1620 });
  });

  it('страниц на 1 меньше минимума или на 1 больше максимума: 422 PAGES_OUT_OF_RANGE', async () => {
    for (const pages of [19, 61]) {
      const res = await quote({ ...base(), pages });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('PAGES_OUT_OF_RANGE');
    }
  });

  it('печать: pages равно числу отпечатков, цена за штуку 61 коп.', async () => {
    const res = await quote({ variantId: printsId, pages: 24, quantity: 1, delivery: 'ems' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ itemsKop: 24 * 61, deliveryKop: 2090 });
  });

  it('несуществующий вариант: 404 VARIANT_NOT_FOUND', async () => {
    const res = await quote({ ...base(), variantId: '00000000-0000-4000-8000-000000000000' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('VARIANT_NOT_FOUND');
  });

  it('некорректные входные данные дают 400: количество 0, дробные страницы, неверная доставка, не uuid', async () => {
    const bad: Record<string, unknown>[] = [
      { ...base(), quantity: 0 },
      { ...base(), pages: 20.5 },
      { ...base(), delivery: 'dhl' },
      { ...base(), variantId: 'not-a-uuid' },
      { ...base(), quantity: -1 },
    ];
    for (const body of bad) {
      const res = await quote(body);
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('BAD_REQUEST');
    }
  });

  it('без токена: 401', async () => {
    const res = await quote(base(), false);
    expect(res.statusCode).toBe(401);
  });
});
