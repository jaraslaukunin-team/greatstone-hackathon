import { z } from 'zod';

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

export const kopecksSchema = z.number().int();

export const cropRotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

export const cropSchema = z.object({
  x: z.number(),
  y: z.number(),
  scale: z.number().positive(),
  rotation: cropRotationSchema,
});

export const cellSchema = z.object({
  photoId: z.string().uuid().nullable(),
  crop: cropSchema,
});

export const pageTemplateSchema = z.enum(['one', 'two', 'four', 'spread-one']);

export const pageSchema = z.object({
  template: pageTemplateSchema,
  cells: z.array(cellSchema).min(1),
  copies: z.number().int().positive().optional(),
});

export const layoutSchema = z.object({
  pages: z.array(pageSchema),
});

export const userDtoSchema = z.object({
  id: z.string().uuid(),
  role: roleSchema,
  displayName: z.string(),
  isGuest: z.boolean(),
  aiConsent: z.boolean(),
});

export const variantDtoSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  format: z.string().min(1),
  pagesMin: z.number().int().positive(),
  pagesMax: z.number().int().positive(),
  basePriceKop: kopecksSchema.nonnegative(),
  pricePerPageKop: kopecksSchema.nonnegative(),
  minDpi: z.number().positive(),
  pageWidthCm: z.number().positive(),
  leadTimeDays: z.number().int().nonnegative(),
});

export const productKindSchema = z.enum(['photobook', 'prints', 'graduation']);

export const productDtoSchema = z.object({
  id: z.string().uuid(),
  kind: productKindSchema,
  title: z.string().min(1),
  description: z.string(),
  variants: z.array(variantDtoSchema),
});

export const deliveryMethodDtoSchema = z.object({
  id: deliveryMethodIdSchema,
  title: z.string().min(1),
  priceKop: kopecksSchema.nonnegative(),
  freeFromKop: kopecksSchema.nonnegative().nullable(),
  etaDays: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
  payOnDelivery: z.boolean(),
});

export const catalogLimitsSchema = z.object({
  maxPhotoBytes: z.number().int().positive(),
  allowedMimeTypes: z.array(z.enum(['image/jpeg', 'image/png'])).min(1),
});

export const catalogDtoSchema = z.object({
  products: z.array(productDtoSchema),
  delivery: z.array(deliveryMethodDtoSchema),
  limits: catalogLimitsSchema,
});

export const photoSourceSchema = z.enum(['gallery', 'ai']);

export const photoDtoSchema = z.object({
  id: z.string().uuid(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  takenAt: z.string().datetime().nullable(),
  url: z.string().url(),
  uploadedBy: z.string().uuid(),
  source: photoSourceSchema,
});

export const projectStatusSchema = z.enum(['draft', 'ordered']);

export const projectDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  variantId: z.string().uuid(),
  ownerId: z.string().uuid(),
  status: projectStatusSchema,
  isShared: z.boolean(),
  expectedMembers: z.number().int().positive().nullable(),
  layout: layoutSchema,
  version: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});

export const quoteRequestSchema = z.object({
  variantId: z.string().uuid(),
  pages: z.number().int().positive(),
  quantity: z.number().int().positive(),
  delivery: deliveryMethodIdSchema,
  promoCode: z.string().min(1).optional(),
});

export const quoteResponseSchema = z.object({
  itemsKop: kopecksSchema.nonnegative(),
  discountKop: kopecksSchema.nonnegative(),
  deliveryKop: kopecksSchema.nonnegative(),
  totalKop: kopecksSchema.nonnegative(),
  currency: z.literal('BYN'),
  promoApplied: z.boolean(),
});

export const addressSchema = z.object({
  recipientName: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
  city: z.string().min(1),
  street: z.string().min(1),
  building: z.string().min(1).optional(),
  apartment: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  comment: z.string().optional(),
});

export const createOrderRequestSchema = z.object({
  projectId: z.string().uuid(),
  delivery: deliveryMethodIdSchema,
  promoCode: z.string().min(1).optional(),
  expectedTotalKop: kopecksSchema.nonnegative(),
  address: addressSchema.optional(),
});

export const orderStatusHistoryItemSchema = z.object({
  status: orderStatusSchema,
  at: z.string().datetime(),
  comment: z.string().optional(),
  changedBy: z.string().uuid().nullable().optional(),
});

export const orderDtoSchema = z.object({
  id: z.string().uuid(),
  number: z.string().min(1),
  projectId: z.string().uuid(),
  status: orderStatusSchema,
  totalKop: kopecksSchema.nonnegative(),
  currency: z.literal('BYN'),
  delivery: deliveryMethodIdSchema,
  createdAt: z.string().datetime(),
  history: z.array(orderStatusHistoryItemSchema),
  interactionIds: z.array(z.string().uuid()).optional(),
});

export const interactionMessageDtoSchema = z.object({
  id: z.string().uuid(),
  body: z.string().min(1),
  authorId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const interactionDtoSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  topic: z.string().min(1),
  messages: z.array(interactionMessageDtoSchema),
  createdAt: z.string().datetime(),
});

export const albumMemberProgressSchema = z.object({
  userId: z.string().uuid(),
  childName: z.string().nullable(),
  photosCount: z.number().int().nonnegative(),
});

export const albumProgressDtoSchema = z.object({
  expected: z.number().int().positive().nullable(),
  members: z.array(albumMemberProgressSchema),
});

export const aiJobStatusSchema = z.enum(['pending', 'done', 'failed']);

export const aiJobDtoSchema = z.object({
  id: z.string().uuid(),
  status: aiJobStatusSchema,
  reason: z.string().optional(),
  resultPhoto: photoDtoSchema.optional(),
});

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});

export const createProjectRequestSchema = z.object({
  variantId: z.string().uuid(),
  title: z.string().min(1),
  isShared: z.boolean().optional(),
  expectedMembers: z.number().int().positive().optional(),
});

export const updateProjectRequestSchema = z.object({
  layout: layoutSchema,
  version: z.number().int().nonnegative(),
});

export const requestCodeSchema = z.object({
  contact: z.string().min(1),
});

export const verifyCodeSchema = z.object({
  contact: z.string().min(1),
  code: z.string().min(1),
});

export const authTokenResponseSchema = z.object({
  token: z.string().min(1),
  user: userDtoSchema,
});

export const createInteractionRequestSchema = z.object({
  topic: z.string().min(1),
  body: z.string().min(1),
});

export const createMessageRequestSchema = z.object({
  body: z.string().min(1),
});

export const acceptInviteRequestSchema = z.object({
  token: z.string().min(1),
  childName: z.string().min(1).optional(),
});

export const operatorStatusRequestSchema = z.object({
  status: orderStatusSchema,
  comment: z.string().optional(),
});

export const aiConsentRequestSchema = z.object({
  consent: z.literal(true),
});

export const aiEditRequestSchema = z.object({
  projectId: z.string().uuid(),
  photoId: z.string().uuid(),
  prompt: z.string().min(1),
});
