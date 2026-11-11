import type { Kopecks } from './money';

export type Role = 'customer' | 'operator';
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
export type Cell = { photoId: string | null; crop: Crop };
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
  title: string;
  description: string;
  variants: VariantDTO[];
};

export type DeliveryOptionDTO = {
  id: DeliveryMethodId;
  title: string;
  priceKop: Kopecks;
  freeFromKop: Kopecks | null;
  etaDays: [number, number];
  payOnDelivery: boolean;
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
  street: string;
  postalCode?: string;
};

export type CreateOrderRequest = {
  projectId: string;
  delivery: DeliveryMethodId;
  promoCode?: string;
  expectedTotalKop: Kopecks;
  address?: OrderAddress;
};

export type OrderHistoryEntry = { status: OrderStatus; at: string; note?: string };

export type OrderDTO = {
  id: string;
  number: string;
  projectId: string;
  status: OrderStatus;
  totalKop: Kopecks;
  currency: 'BYN';
  delivery: DeliveryMethodId;
  createdAt: string;
  history: OrderHistoryEntry[];
  interactionIds: string[];
};

export type InteractionDTO = {
  id: string;
  projectId: string;
  userId: string;
  kind: 'joined' | 'photos_added' | 'approved';
  createdAt: string;
};

export type AlbumProgressDTO = {
  projectId: string;
  expectedMembers: number;
  joinedMembers: number;
  photosCount: number;
  approvedMembers: number;
};

export type AiJobDTO = {
  id: string;
  status: 'pending' | 'done' | 'failed';
  reason?: string;
  resultPhoto?: PhotoDTO;
};

export type ApiErrorBody = { error: { code: string; message: string } };
