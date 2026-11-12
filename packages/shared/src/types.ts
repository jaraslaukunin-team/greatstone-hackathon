import type { Kopecks } from './money';

export type Role = 'customer' | 'operator';
export type PaymentMethod = 'card' | 'erip' | 'courier';
export type OrderStatus =
  | 'accepted'
  | 'moderation'
  | 'production'
  | 'ready_for_delivery'
  | 'completed'
  | 'cancelled';
export type DeliveryMethodId = 'courier_minsk' | 'ems' | 'belpost';

export type Template = 'one' | 'two' | 'four' | 'spread-one';
export type Rotation = 0 | 90 | 180 | 270;
export type Crop = { x: number; y: number; scale: number; rotation: Rotation };
export type Cell = { photoId: string | null; crop: Crop; fit?: 'contain' | 'cover' };
export type Page = { template: Template; cells: Cell[]; copies?: number };
export type Layout = { pages: Page[] };

export type UserDTO = {
  id: string;
  role: Role;
  displayName: string;
  isGuest: boolean;
  aiConsent: boolean;
};

export type VariantDTO = {
  id: string;
  productId: string;
  format: string;
  pagesMin: number;
  pagesMax: number;
  basePriceKop: Kopecks;
  pricePerPageKop: Kopecks;
  minDpi: number;
  pageWidthCm: number;
  leadTimeDays: number;
};

export type ProductDTO = {
  id: string;
  kind: 'photobook' | 'prints' | 'graduation';
  /** Линейка печати: 'photo' — фотопечать, 'digital' — цифровая, null — не применимо (книги). */
  line: 'photo' | 'digital' | null;
  title: string;
  description: string;
  variants: VariantDTO[];
};

export type PickupPoint = {
  id: string;
  title: string;
  address: string;
};

export type DeliveryOptionDTO = {
  id: DeliveryMethodId;
  title: string;
  priceKop: Kopecks;
  freeFromKop: Kopecks | null;
  etaDays: [number, number];
  payOnDelivery: boolean;
  pickupPoints?: PickupPoint[];
};

export type LimitsDTO = {
  maxPhotoBytes: number;
  allowedMimeTypes: string[];
};

export type CatalogDTO = {
  products: ProductDTO[];
  delivery: DeliveryOptionDTO[];
  limits: LimitsDTO;
};

export type PhotoDTO = {
  id: string;
  width: number;
  height: number;
  takenAt: string | null;
  url: string;
  uploadedBy: string | null;
  source: 'gallery' | 'ai';
};

export type ProjectDTO = {
  id: string;
  title: string;
  variantId: string;
  ownerId: string;
  status: 'draft' | 'ordered';
  isShared: boolean;
  expectedMembers: number | null;
  /** Нужен ли пароль, чтобы вступить в общий альбом. Сам пароль и его хеш наружу не отдаются. */
  hasPassword: boolean;
  layout: Layout;
  version: number;
  updatedAt: string;
};

export type QuoteRequest = {
  variantId: string;
  pages: number;
  quantity: number;
  delivery: DeliveryMethodId;
  promoCode?: string;
};

export type QuoteResponse = {
  itemsKop: Kopecks;
  deliveryKop: Kopecks;
  discountKop: Kopecks;
  totalKop: Kopecks;
  currency: 'BYN';
  promoApplied: boolean;
};

export type OrderAddress = {
  recipient: string;
  phone: string;
  city: string;
  /** Required unless pickupPointId is provided (Белпочта ПВЗ). */
  street?: string;
  postalCode?: string;
  /** Идентификатор пункта выдачи (только для Белпочты). */
  pickupPointId?: string;
};

export type CreateOrderRequest = {
  projectId: string;
  delivery: DeliveryMethodId;
  promoCode?: string;
  expectedTotalKop: Kopecks;
  address?: OrderAddress;
  /** Способ оплаты, по умолчанию card. */
  payment?: PaymentMethod;
};

export type OrderHistoryEntry = { status: OrderStatus; at: string; note?: string };

export type OrderDTO = {
  id: string;
  number: string;
  projectId: string | null;
  status: OrderStatus;
  totalKop: Kopecks;
  currency: 'BYN';
  delivery: DeliveryMethodId;
  payment: PaymentMethod;
  eripNumber: string | null;
  createdAt: string;
  history: OrderHistoryEntry[];
  interactionIds: string[];
};

export type InteractionMessageDTO = {
  id: string;
  authorId: string | null;
  authorRole: Role | null;
  body: string;
  createdAt: string;
};

export type InteractionDTO = {
  id: string;
  orderId: string | null;
  customerId: string | null;
  topic: string;
  status: 'open' | 'answered' | 'closed';
  createdAt: string;
  messages: InteractionMessageDTO[];
};

export type InviteDTO = { token: string; url: string; expiresAt: string };

export type AlbumMemberDTO = {
  userId: string;
  childName: string | null;
  role: 'organizer' | 'contributor';
  photosCount: number;
};

export type AlbumProgressDTO = { expected: number | null; members: AlbumMemberDTO[] };

export type AiEditKind = 'edit' | 'upscale';

/** Что приложение хранит о пользователе: для экрана «Мои данные и безопасность». */
export type DataSummaryDTO = {
  projects: number;
  photos: number;
  orders: number;
  aiConsentAt: string | null;
};

export type AiJobDTO = {
  id: string;
  status: 'pending' | 'done' | 'failed';
  kind?: AiEditKind;
  reason?: string;
  resultPhoto?: PhotoDTO;
};

export type AiAdjustRequest = {
  projectId: string;
  photoId: string;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpen?: number;
};

export type AiChatMessage = { role: 'user' | 'assistant'; content: string };

export type AiChatRequest = {
  messages: AiChatMessage[];
  orderId?: string;
};

export type AiChatResponse = {
  reply: string;
  messages: AiChatMessage[];
};

export type ApiErrorBody = { error: { code: string; message: string; details?: Record<string, unknown> } };

export type AuditEntryDTO = {
  id: string;
  userId: string | null;
  at: string;
  action: string;
  objectType: string | null;
  objectId: string | null;
  result: 'ok' | 'denied' | 'error';
};
