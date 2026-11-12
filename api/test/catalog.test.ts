import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { catalogSchema, productSchema } from '@picpac/shared';
import { seed, testApp } from './helpers.js';

describe('каталог', () => {
  let app: FastifyInstance;
  let reset: () => Promise<void>;
  let db: Awaited<ReturnType<typeof testApp>>['db'];

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
  });

  const guestToken = async () =>
    ((await app.inject({ method: 'POST', url: '/auth/guest' })).json() as { token: string }).token;
  const get = async (url: string, token?: string) =>
    app.inject({ method: 'GET', url, headers: token ? { authorization: `Bearer ${token}` } : {} });

  it('гость получает 13 продуктов и ответ проходит схему каталога', async () => {
    const res = await get('/catalog', await guestToken());
    expect(res.statusCode).toBe(200);
    const catalog = catalogSchema.parse(res.json());
    expect(catalog.products).toHaveLength(13);
    expect(catalog.products.every((p) => p.description.length > 0)).toBe(true);
  });

  it('без токена каталог недоступен: 401', async () => {
    const res = await get('/catalog');
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('у каждого варианта есть цены, minDpi и срок изготовления продукта', async () => {
    const catalog = catalogSchema.parse((await get('/catalog', await guestToken())).json());
    const variants = catalog.products.flatMap((p) => p.variants.map((v) => ({ p, v })));
    expect(variants.length).toBeGreaterThanOrEqual(12);
    for (const { p, v } of variants) {
      expect(v.basePriceKop > 0 || v.pricePerPageKop > 0).toBe(true);
      expect(v.minDpi).toBe(150);
      expect(v.productId).toBe(p.id);
    }
    const classic = catalog.products.find((p) => p.title === 'Фотокнига Classic')!;
    expect(classic.variants.every((v) => v.leadTimeDays === 7)).toBe(true);
    const c20 = classic.variants.find((v) => v.format === 'Classic 20×20')!;
    expect(c20).toMatchObject({ basePriceKop: 8100, pricePerPageKop: 150, pagesMin: 20, pagesMax: 60, pageWidthCm: 20 });
  });

  it('способы доставки несут порог бесплатной доставки и признак оплаты при получении', async () => {
    const catalog = catalogSchema.parse((await get('/catalog', await guestToken())).json());
    const byId = Object.fromEntries(catalog.delivery.map((d) => [d.id, d]));
    expect(byId.ems).toMatchObject({ priceKop: 2090, freeFromKop: 30000, payOnDelivery: false });
    expect(byId.belpost).toMatchObject({ priceKop: 690, freeFromKop: 15000 });
    expect(byId.courier_minsk).toMatchObject({ freeFromKop: null, payOnDelivery: true });
  });

  it('лимиты загрузки: 15 МБ и только JPEG/PNG', async () => {
    const catalog = catalogSchema.parse((await get('/catalog', await guestToken())).json());
    expect(catalog.limits).toEqual({ maxPhotoBytes: 15728640, allowedMimeTypes: ['image/jpeg', 'image/png'] });
  });

  it('GET /catalog/:id возвращает один продукт с его вариантами', async () => {
    const token = await guestToken();
    const all = catalogSchema.parse((await get('/catalog', token)).json());
    const premium = all.products.find((p) => p.title === 'Фотокнига Premium')!;
    const res = await get(`/catalog/${premium.id}`, token);
    expect(res.statusCode).toBe(200);
    expect(productSchema.parse(res.json())).toEqual(premium);
  });

  it('несуществующий продукт и невалидный id дают 404 NOT_FOUND', async () => {
    const token = await guestToken();
    const missing = await get('/catalog/00000000-0000-4000-8000-000000000000', token);
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('NOT_FOUND');
    const malformed = await get('/catalog/not-a-uuid', token);
    expect(malformed.statusCode).toBe(404);
    expect(malformed.json().error.code).toBe('NOT_FOUND');
  });

  it('линейки печати: фотоотпечатки имеют line=photo, цифровая печать — line=digital, книги — line=null', async () => {
    const catalog = catalogSchema.parse((await get('/catalog', await guestToken())).json());
    const byTitle = Object.fromEntries(catalog.products.map((p) => [p.title, p]));

    // Фотопечать
    expect(byTitle['Печать 10×15']!.line).toBe('photo');
    expect(byTitle['Печать 15×20']!.line).toBe('photo');

    // Цифровая печать
    const digital = byTitle['Цифровая печать']!;
    expect(digital.line).toBe('digital');
    expect(digital.kind).toBe('prints');
    const digitalByFormat = Object.fromEntries(digital.variants.map((v) => [v.format, v]));
    expect(digitalByFormat['Открытка 10×15']!).toMatchObject({ basePriceKop: 150, pricePerPageKop: 150, pageWidthCm: 10 });
    expect(digitalByFormat['Постер 30×40']!).toMatchObject({ basePriceKop: 1200, pricePerPageKop: 1200, pageWidthCm: 30 });
    expect(digitalByFormat['Постер 40×60']!).toMatchObject({ basePriceKop: 1900, pricePerPageKop: 1900, pageWidthCm: 40 });

    // Фотокниги и альбом не имеют линейки
    for (const title of ['Фотокнига Lite', 'Фотокнига Classic', 'Фотокнига Premium', 'Выпускной альбом']) {
      expect(byTitle[title]!.line).toBeNull();
    }
  });
});
