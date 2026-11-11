import { randomUUID } from 'node:crypto';
import type {
  CatalogDTO,
  InteractionDTO,
  OrderDTO,
  PhotoDTO,
  ProjectDTO,
  UserDTO,
  VariantDTO,
} from '@picpac/shared';

export type Session = {
  token: string;
  user: UserDTO;
};

export type MockOrder = OrderDTO & {
  customerId: string;
  projectId: string;
  requestHash: string;
  idempotencyKey: string;
};

export type MockState = {
  sessions: Map<string, Session>;
  authCodes: Map<string, { code: string; expiresAt: number }>;
  users: Map<string, UserDTO>;
  projects: Map<string, ProjectDTO>;
  photos: Map<string, PhotoDTO & { projectId: string }>;
  orders: Map<string, MockOrder>;
  interactions: Map<string, InteractionDTO>;
  aiJobs: Map<string, { id: string; status: 'pending' | 'done' | 'failed'; reason?: string; resultPhoto?: PhotoDTO }>;
  albums: Map<string, { projectId: string; expectedMembers: number; members: Set<string>; invites: Map<string, string> }>;
};

const classicVariant: VariantDTO = {
  id: '00000000-0000-4000-8000-000000000101',
  productId: '00000000-0000-4000-8000-000000000001',
  format: '20×20',
  pagesMin: 20,
  pagesMax: 60,
  basePriceKop: 8100,
  pricePerPageKop: 150,
  minDpi: 150,
  pageWidthCm: 20,
  leadTimeDays: 7,
};

export function createInitialCatalog(): CatalogDTO {
  return {
    products: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        kind: 'photobook',
        title: 'Classic',
        description: 'Плотные страницы, раскрытие на 180°',
        variants: [classicVariant],
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        kind: 'photobook',
        title: 'Lite',
        description: 'Гибкие страницы. Больше фотографий.',
        variants: [
          {
            ...classicVariant,
            id: '00000000-0000-4000-8000-000000000102',
            productId: '00000000-0000-4000-8000-000000000002',
            basePriceKop: 7000,
            pricePerPageKop: 100,
          },
        ],
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        kind: 'photobook',
        title: 'Premium',
        description: 'Фотобумага и толстые страницы.',
        variants: [
          {
            ...classicVariant,
            id: '00000000-0000-4000-8000-000000000103',
            productId: '00000000-0000-4000-8000-000000000003',
            basePriceKop: 10050,
            pricePerPageKop: 200,
          },
        ],
      },
      {
        id: '00000000-0000-4000-8000-000000000004',
        kind: 'graduation',
        title: 'Выпускной альбом',
        description: 'Собираем вместе с классом',
        variants: [
          {
            ...classicVariant,
            id: '00000000-0000-4000-8000-000000000104',
            productId: '00000000-0000-4000-8000-000000000004',
            basePriceKop: 12000,
          },
        ],
      },
      {
        id: '00000000-0000-4000-8000-000000000005',
        kind: 'prints',
        title: 'Печать 10×15',
        description: 'Фотохимическая печать',
        variants: [
          {
            ...classicVariant,
            id: '00000000-0000-4000-8000-000000000105',
            productId: '00000000-0000-4000-8000-000000000005',
            format: '10×15',
            pagesMin: 1,
            pagesMax: 500,
            basePriceKop: 55,
            pricePerPageKop: 55,
            pageWidthCm: 15,
          },
        ],
      },
      {
        id: '00000000-0000-4000-8000-000000000006',
        kind: 'prints',
        title: 'Печать 15×20',
        description: 'Фотохимическая печать',
        variants: [
          {
            ...classicVariant,
            id: '00000000-0000-4000-8000-000000000106',
            productId: '00000000-0000-4000-8000-000000000006',
            format: '15×20',
            pagesMin: 1,
            pagesMax: 500,
            basePriceKop: 120,
            pricePerPageKop: 120,
            pageWidthCm: 20,
          },
        ],
      },
    ],
    delivery: [
      {
        id: 'courier_minsk',
        title: 'Курьер по Минску',
        priceKop: 0,
        freeFromKop: null,
        etaDays: [1, 2],
        payOnDelivery: true,
      },
      {
        id: 'ems',
        title: 'EMS',
        priceKop: 2090,
        freeFromKop: 30000,
        etaDays: [1, 2],
        payOnDelivery: false,
      },
      {
        id: 'belpost',
        title: 'Белпочта',
        priceKop: 690,
        freeFromKop: 15000,
        etaDays: [2, 5],
        payOnDelivery: false,
      },
    ],
    limits: {
      maxPhotoBytes: 15 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png'],
    },
  };
}

export const catalog = createInitialCatalog();

export function findVariant(variantId: string): VariantDTO | undefined {
  for (const product of catalog.products) {
    const found = product.variants.find((v) => v.id === variantId);
    if (found) return found;
  }
  return undefined;
}

export function calcMockPrice(input: {
  variant: VariantDTO;
  pages: number;
  quantity: number;
  discountPercent: number;
  deliveryId: 'courier_minsk' | 'ems' | 'belpost';
}) {
  const unit =
    input.variant.basePriceKop +
    Math.max(0, input.pages - input.variant.pagesMin) * input.variant.pricePerPageKop;
  const itemsKop = unit * input.quantity;
  const discountKop = Math.round((itemsKop * input.discountPercent) / 100);
  const delivery = catalog.delivery.find((d) => d.id === input.deliveryId)!;
  const afterDiscount = itemsKop - discountKop;
  const deliveryKop =
    delivery.freeFromKop != null && afterDiscount >= delivery.freeFromKop
      ? 0
      : delivery.priceKop;
  return {
    itemsKop,
    discountKop,
    deliveryKop,
    totalKop: afterDiscount + deliveryKop,
  };
}

export function createState(): MockState {
  const customer: UserDTO = {
    id: '00000000-0000-4000-8000-000000000201',
    role: 'customer',
    displayName: 'Анна',
    isGuest: false,
    aiConsent: false,
  };
  const operator: UserDTO = {
    id: '00000000-0000-4000-8000-000000000202',
    role: 'operator',
    displayName: 'Оператор',
    isGuest: false,
    aiConsent: false,
  };

  return {
    sessions: new Map(),
    authCodes: new Map(),
    users: new Map([
      [customer.id, customer],
      [operator.id, operator],
    ]),
    projects: new Map(),
    photos: new Map(),
    orders: new Map(),
    interactions: new Map(),
    aiJobs: new Map(),
    albums: new Map(),
  };
}

export function newId(): string {
  return randomUUID();
}

export const PROMO: Record<string, { percent: number; expired?: boolean }> = {
  HELLO10: { percent: 10 },
  SCHOOL15: { percent: 15 },
  OLD20: { percent: 20, expired: true },
};
