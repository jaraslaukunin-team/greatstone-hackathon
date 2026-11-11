import { ApiRequestError, NetworkError } from '../api/client';
import { createCheckoutController } from './useCheckout';
import { ensureIdempotencyKey } from './idempotency';
import type { ProjectDraft } from '../project/projectStore';

const draftBase: ProjectDraft = {
  project: {
    id: '00000000-0000-4000-8000-000000000301',
    title: 'Книга',
    variantId: '00000000-0000-4000-8000-000000000101',
    ownerId: '00000000-0000-4000-8000-000000000201',
    status: 'draft',
    isShared: false,
    expectedMembers: null,
    hasPassword: false,
    layout: { pages: [] },
    version: 1,
    updatedAt: '2026-11-11T12:00:00.000Z',
  },
  layout: { pages: [] },
  idempotencyKey: null,
};

describe('checkout', () => {
  it('повторный ensureIdempotencyKey возвращает тот же ключ', () => {
    const draft = { ...draftBase, idempotencyKey: null as string | null };
    const key1 = ensureIdempotencyKey(draft, (k) => {
      draft.idempotencyKey = k;
    }, () => '11111111-1111-4111-8111-111111111111');
    const key2 = ensureIdempotencyKey(draft, (k) => {
      draft.idempotencyKey = k;
    }, () => '22222222-2222-4222-8222-222222222222');
    expect(key1).toBe('11111111-1111-4111-8111-111111111111');
    expect(key2).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('ключ не в формате uuid (от старой версии) заменяется новым', () => {
    const draft = { ...draftBase, idempotencyKey: 'idem-123-abc' as string | null };
    const key = ensureIdempotencyKey(draft, (k) => {
      draft.idempotencyKey = k;
    });
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('submit при NetworkError оставляет ключ', async () => {
    const draft = { ...draftBase, idempotencyKey: null as string | null };
    const client = {
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      post: jest.fn(async (path: string) => {
        if (path === '/price-quote') {
          return {
            itemsKop: 8100,
            discountKop: 0,
            deliveryKop: 690,
            totalKop: 8790,
            currency: 'BYN',
            promoApplied: false,
          };
        }
        throw new NetworkError();
      }),
    };
    const controller = createCheckoutController({
      client,
      draft,
      setIdempotencyKey: (key) => {
        draft.idempotencyKey = key;
      },
      delivery: 'belpost',
      pages: 20,
    });
    await expect(controller.submit()).rejects.toBeInstanceOf(NetworkError);
    expect(draft.idempotencyKey).toBeTruthy();
  });

  it('PRICE_CHANGED обновляет сумму и не очищает успешный заказ', async () => {
    const draft = { ...draftBase, idempotencyKey: null as string | null };
    let calls = 0;
    const client = {
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      post: jest.fn(async (path: string) => {
        if (path === '/price-quote') {
          calls += 1;
          return {
            itemsKop: 8100 + calls,
            discountKop: 0,
            deliveryKop: 690,
            totalKop: 8790 + calls,
            currency: 'BYN',
            promoApplied: false,
          };
        }
        throw new ApiRequestError(409, 'PRICE_CHANGED', 'Цена изменилась');
      }),
    };
    const controller = createCheckoutController({
      client,
      draft,
      setIdempotencyKey: (key) => {
        draft.idempotencyKey = key;
      },
      delivery: 'belpost',
      pages: 20,
    });
    await expect(controller.submit()).rejects.toMatchObject({ code: 'PRICE_CHANGED' });
    expect(draft.idempotencyKey).toBeTruthy();
  });

  it('успешный ответ очищает ключ', async () => {
    const draft = { ...draftBase, idempotencyKey: null as string | null };
    const order = {
      id: '00000000-0000-4000-8000-000000000401',
      number: 'PP-000142',
      projectId: draft.project.id,
      status: 'accepted',
      totalKop: 8790,
      currency: 'BYN',
      delivery: 'belpost',
      createdAt: '2026-11-11T12:00:00.000Z',
      history: [],
    };
    const client = {
      get: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      post: jest.fn(async (path: string) => {
        if (path === '/price-quote') {
          return {
            itemsKop: 8100,
            discountKop: 0,
            deliveryKop: 690,
            totalKop: 8790,
            currency: 'BYN',
            promoApplied: false,
          };
        }
        return order;
      }),
    };
    const controller = createCheckoutController({
      client,
      draft,
      setIdempotencyKey: (key) => {
        draft.idempotencyKey = key;
      },
      delivery: 'belpost',
      pages: 20,
    });
    const result = await controller.submit();
    expect(result.id).toBe(order.id);
    expect(draft.idempotencyKey).toBeNull();
  });
});
