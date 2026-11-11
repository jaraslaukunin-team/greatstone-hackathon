import type { z } from 'zod';
import type {
  addressSchema,
  aiJobDtoSchema,
  albumProgressDtoSchema,
  apiErrorBodySchema,
  catalogDtoSchema,
  createOrderRequestSchema,
  interactionDtoSchema,
  layoutSchema,
  orderDtoSchema,
  photoDtoSchema,
  productDtoSchema,
  projectDtoSchema,
  quoteRequestSchema,
  quoteResponseSchema,
  userDtoSchema,
  variantDtoSchema,
} from './schemas.js';

/** Целые копейки BYN. */
export type Kopecks = number;

export type Role = 'customer' | 'operator';

export type OrderStatus =
  | 'accepted'
  | 'moderation'
  | 'production'
  | 'ready_for_delivery'
  | 'completed'
  | 'cancelled';

export type DeliveryMethodId = 'courier_minsk' | 'ems' | 'belpost';

export type CropRotation = 0 | 90 | 180 | 270;

export type PageTemplate = 'one' | 'two' | 'four' | 'spread-one';

export type Cell = {
  photoId: string | null;
  crop: {
    x: number;
    y: number;
    scale: number;
    rotation: CropRotation;
  };
};

export type Page = {
  template: PageTemplate;
  cells: Cell[];
  copies?: number;
};

export type Layout = {
  pages: Page[];
};

export type DeliveryMethodDTO = {
  id: DeliveryMethodId;
  title: string;
  priceKop: Kopecks;
  freeFromKop: Kopecks | null;
  etaDays: [number, number];
  payOnDelivery: boolean;
};

export type CatalogLimits = {
  maxPhotoBytes: number;
  allowedMimeTypes: Array<'image/jpeg' | 'image/png'>;
};

export type OrderStatusHistoryItem = {
  status: OrderStatus;
  at: string;
  comment?: string;
  changedBy?: string | null;
};

export type InteractionMessageDTO = {
  id: string;
  body: string;
  authorId: string;
  createdAt: string;
};

export type UserDTO = z.infer<typeof userDtoSchema>;
export type VariantDTO = z.infer<typeof variantDtoSchema>;
export type ProductDTO = z.infer<typeof productDtoSchema>;
export type CatalogDTO = z.infer<typeof catalogDtoSchema>;
export type PhotoDTO = z.infer<typeof photoDtoSchema>;
export type ProjectDTO = z.infer<typeof projectDtoSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type OrderDTO = z.infer<typeof orderDtoSchema>;
export type InteractionDTO = z.infer<typeof interactionDtoSchema>;
export type AlbumProgressDTO = z.infer<typeof albumProgressDtoSchema>;
export type AiJobDTO = z.infer<typeof aiJobDtoSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
export type Address = z.infer<typeof addressSchema>;
export type LayoutDTO = z.infer<typeof layoutSchema>;
