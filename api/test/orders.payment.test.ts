import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { orderSchema, type Layout } from '@picpac/shared';
import { orders, productVariants, projectPhotos, projects } from '../src/db/schema.js';
import { seed, testApp } from './helpers.js';

type Session = { token: string; id: string };

const ADDRESS_MINSK = {
  recipient: 'Иван Иванов',
  phone: '+375291234567',
  city: 'Минск',
  street: 'ул. Притыцкого, 1',
};
const ADDRESS_BREST = {
  recipient: 'Пётр Петров',
  phone: '+375291234567',
  city: 'Брест',
  street: 'ул. Советская, 5',
};

describe('payment method & ERIP & courier zone', () => {
  let app: FastifyInstance;
  let db: Awaited<ReturnType<typeof testApp>>['db'];
  let reset: () => Promise<void>;
  let alice: Session;

  beforeAll(async () => {
    ({ app, db, reset } = await testApp());
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  const guest = async (): Promise<Session> => {
    const j = (await app.inject({ method: 'POST', url: '/auth/guest' })).json() as {
      token: string;
      user: { id: string };
    };
    return { token: j.token, id: j.user.id };
  };

  const call = (s: Session, method: 'POST' | 'GET', url: string, payload?: unknown, key?: string) =>
    app.inject({
      method,
      url,
      payload: payload as object | undefined,
      headers: { authorization: `Bearer ${s.token}`, ...(key ? { 'idempotency-key': key } : {}) },
    });

  const variantByFormat = async (format: string) =>
    (await db.select().from(productVariants).where(eq(productVariants.format, format)))[0]!.id;

  async function makeProject(owner: Session, opts: { format?: string; pages?: number } = {}) {
    const variantId = await variantByFormat(opts.format ?? 'Classic 20×20');
    const project = (
      await call(owner, 'POST', '/projects', { variantId, title: 'Тест оплаты' })
    ).json() as { id: string };
    const count = opts.pages ?? 20;
    const pages: Layout['pages'] = [];
    for (let i = 0; i < count; i++) {
      const photoId = randomUUID();
      await db.insert(projectPhotos).values({
        id: photoId,
        projectId: project.id,
        uploadedBy: owner.id,
        storagePath: `projects/${project.id}/${photoId}`,
        position: i,
        width: 2400,
        height: 1600,
      });
      pages.push({ template: 'one', cells: [{ photoId, crop: { x: 0, y: 0, scale: 1, rotation: 0 } }] });
    }
    await db.update(projects).set({ layout: { pages } }).where(eq(projects.id, project.id));
    return project.id;
  }

  const place = (
    s: Session,
    projectId: string,
    extra: Record<string, unknown> = {},
    key = randomUUID(),
  ) =>
    call(
      s,
      'POST',
      '/orders',
      {
        projectId,
        delivery: 'belpost',
        expectedTotalKop: 8790,
        address: ADDRESS_MINSK,
        ...extra,
      },
      key,
    );

  beforeEach(async () => {
    await reset();
    await seed(db);
    app.clock.now = () => new Date();
    alice = await guest();
  });

  it('по умолчанию payment=card, eripNumber=null', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId);
    expect(res.statusCode).toBe(201);
    const order = orderSchema.parse(res.json());
    expect(order.payment).toBe('card');
    expect(order.eripNumber).toBeNull();
  });

  it('явный payment=card даёт eripNumber=null', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId, { payment: 'card' });
    expect(res.statusCode).toBe(201);
    const order = orderSchema.parse(res.json());
    expect(order.payment).toBe('card');
    expect(order.eripNumber).toBeNull();
  });

  it('payment=erip: eripNumber — 27 цифр', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId, { payment: 'erip' });
    expect(res.statusCode).toBe(201);
    const order = orderSchema.parse(res.json());
    expect(order.payment).toBe('erip');
    expect(order.eripNumber).toMatch(/^\d{27}$/);
  });

  it('payment=courier с belpost → 422 PAYMENT_NOT_AVAILABLE', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId, { payment: 'courier', delivery: 'belpost', expectedTotalKop: 8790 });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('PAYMENT_NOT_AVAILABLE');
  });

  it('payment=courier с courier_minsk и городом Минск — 201', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId, {
      payment: 'courier',
      delivery: 'courier_minsk',
      expectedTotalKop: 8100,
      address: ADDRESS_MINSK,
    });
    expect(res.statusCode).toBe(201);
    const order = orderSchema.parse(res.json());
    expect(order.payment).toBe('courier');
    expect(order.eripNumber).toBeNull();
  });

  it('courier_minsk с городом Брест → 422 OUTSIDE_COURIER_ZONE', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId, {
      delivery: 'courier_minsk',
      expectedTotalKop: 8100,
      address: ADDRESS_BREST,
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('OUTSIDE_COURIER_ZONE');
  });

  it('courier_minsk с городом Minsk (латиница) — 201', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId, {
      delivery: 'courier_minsk',
      expectedTotalKop: 8100,
      address: { ...ADDRESS_MINSK, city: 'Minsk' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('belpost с pickupPointId известным и без street — 201', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId, {
      address: {
        recipient: 'Иван Иванов',
        phone: '+375291234567',
        city: 'Минск',
        pickupPointId: 'pp-minsk-1',
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('belpost с неизвестным pickupPointId → 422 PICKUP_POINT_UNKNOWN', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId, {
      address: {
        recipient: 'Иван Иванов',
        phone: '+375291234567',
        city: 'Минск',
        pickupPointId: 'pp-unknown-99',
      },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('PICKUP_POINT_UNKNOWN');
  });

  it('belpost с pickupPointId и street одновременно — 201 (street игнорируется)', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId, {
      address: {
        recipient: 'Иван Иванов',
        phone: '+375291234567',
        city: 'Минск',
        street: 'ул. Ленина, 1',
        pickupPointId: 'pp-minsk-2',
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('адрес без street и без pickupPointId → 400 (schema validation)', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId, {
      address: { recipient: 'Иван Иванов', phone: '+375291234567', city: 'Минск' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('каталог: belpost содержит 6 пунктов выдачи', async () => {
    const res = await app.inject({ method: 'GET', url: '/catalog' });
    expect(res.statusCode).toBe(200);
    const catalog = res.json() as { delivery: Array<{ id: string; pickupPoints?: unknown[] }> };
    const belpost = catalog.delivery.find((d) => d.id === 'belpost');
    expect(belpost).toBeDefined();
    expect(belpost?.pickupPoints).toHaveLength(6);
  });

  it('orders row сохраняет paymentMethod=erip и eripNumber в БД', async () => {
    const projectId = await makeProject(alice);
    const res = await place(alice, projectId, { payment: 'erip' });
    expect(res.statusCode).toBe(201);
    const orderId = (res.json() as { id: string }).id;
    const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
    expect(row!.paymentMethod).toBe('erip');
    expect(row!.eripNumber).toMatch(/^\d{27}$/);
  });
});
