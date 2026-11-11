import { z } from 'zod';

const iso = z.string().datetime();
const kop = z.number().int().nonnegative();

export const roleSchema = z.enum(['customer', 'operator']);
export const orderStatusSchema = z.enum([
  'accepted',
  'moderation',
  'production',
  'ready_for_delivery',
  'completed',
  'cancelled',
]);
export const deliveryMethodIdSchema = z.enum(['courier_minsk', 'ems', 'belpost']);

export const cropSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number().positive(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
});
export const cellSchema = z.object({ photoId: z.string().nullable(), crop: cropSchema });
export const pageSchema = z.object({
  template: z.enum(['one', 'two', 'four', 'spread-one']),
  cells: z.array(cellSchema),
  copies: z.number().int().positive().optional(),
});
export const layoutSchema = z.object({ pages: z.array(pageSchema) });

export const userSchema = z.object({
  id: z.string(),
  role: roleSchema,
  displayName: z.string(),
  isGuest: z.boolean(),
  aiConsent: z.boolean(),
});

export const variantSchema = z.object({
  id: z.string(),
  productId: z.string(),
  format: z.string(),
  pagesMin: z.number().int(),
  pagesMax: z.number().int(),
  basePriceKop: kop,
  pricePerPageKop: kop,
  minDpi: z.number(),
  pageWidthCm: z.number(),
  leadTimeDays: z.number().int(),
});
export const productSchema = z.object({
  id: z.string(),
  kind: z.enum(['photobook', 'prints', 'graduation']),
  title: z.string(),
  description: z.string(),
  variants: z.array(variantSchema),
});
export const deliveryOptionSchema = z.object({
  id: deliveryMethodIdSchema,
  title: z.string(),
  priceKop: kop,
  freeFromKop: kop.nullable(),
  etaDays: z.tuple([z.number().int(), z.number().int()]),
  payOnDelivery: z.boolean(),
});
export const limitsSchema = z.object({
  maxPhotoBytes: z.number().int().positive(),
  allowedMimeTypes: z.array(z.string()),
});
export const catalogSchema = z.object({
  products: z.array(productSchema),
  delivery: z.array(deliveryOptionSchema),
  limits: limitsSchema,
});

export const photoSchema = z.object({
  id: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  takenAt: iso.nullable(),
  url: z.string(),
  uploadedBy: z.string(),
  source: z.enum(['gallery', 'ai']),
});

export const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  variantId: z.string(),
  ownerId: z.string(),
  status: z.enum(['draft', 'ordered']),
  isShared: z.boolean(),
  expectedMembers: z.number().int().nonnegative(),
  layout: layoutSchema,
  version: z.number().int(),
  updatedAt: iso,
});

export const quoteRequestSchema = z.object({
  variantId: z.string().uuid(),
  pages: z.number().int().positive(),
  quantity: z.number().int().positive(),
  delivery: deliveryMethodIdSchema,
  promoCode: z.string().max(50).optional(),
});
export const quoteResponseSchema = z.object({
  itemsKop: kop,
  deliveryKop: kop,
  discountKop: kop,
  totalKop: kop,
  currency: z.literal('BYN'),
  promoApplied: z.boolean(),
});

export const orderAddressSchema = z.object({
  recipient: z.string().min(1),
  phone: z.string().min(1),
  city: z.string().min(1),
  street: z.string().min(1),
  postalCode: z.string().optional(),
});
export const createOrderRequestSchema = z.object({
  projectId: z.string().uuid(),
  delivery: deliveryMethodIdSchema,
  promoCode: z.string().optional(),
  expectedTotalKop: kop,
  address: orderAddressSchema.optional(),
});

export const orderSchema = z.object({
  id: z.string(),
  number: z.string(),
  projectId: z.string(),
  status: orderStatusSchema,
  totalKop: kop,
  currency: z.literal('BYN'),
  delivery: deliveryMethodIdSchema,
  createdAt: iso,
  history: z.array(z.object({ status: orderStatusSchema, at: iso, note: z.string().optional() })),
  interactionIds: z.array(z.string()),
});

export const interactionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  userId: z.string(),
  kind: z.enum(['joined', 'photos_added', 'approved']),
  createdAt: iso,
});
export const albumProgressSchema = z.object({
  projectId: z.string(),
  expectedMembers: z.number().int().nonnegative(),
  joinedMembers: z.number().int().nonnegative(),
  photosCount: z.number().int().nonnegative(),
  approvedMembers: z.number().int().nonnegative(),
});

export const aiJobSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'done', 'failed']),
  reason: z.string().optional(),
  resultPhoto: photoSchema.optional(),
});

export const apiErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
