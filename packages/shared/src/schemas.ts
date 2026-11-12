import { z } from 'zod';
import { ASPECT_RATIOS } from './aspect';

const iso = z.string().datetime();
const kop = z.number().int().nonnegative();

export const roleSchema = z.enum(['customer', 'operator']);
export const paymentMethodSchema = z.enum(['card', 'erip', 'courier']);
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
export const fitModeSchema = z.enum(['contain', 'cover']);
// fit необязателен: старые макеты без него читаются как contain.
export const frameSchema = z.object({
  x: z.number().min(-0.1).max(1.1),
  y: z.number().min(-0.1).max(1.1),
  w: z.number().min(0.05).max(1.2),
  h: z.number().min(0.05).max(1.2),
  rot: z.number().min(-180).max(180),
});
export const cellSchema = z.object({
  photoId: z.string().nullable(),
  crop: cropSchema,
  fit: fitModeSchema.optional(),
  frame: frameSchema.optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  border: z.boolean().optional(),
});
export const pageTextSchema = z.object({
  text: z.string().max(200),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  style: z.enum(['title', 'caption', 'date', 'quote']),
  rot: z.number().min(-180).max(180).optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
});
// bg и texts необязательны: старые макеты без них читаются как раньше.
export const pageSchema = z.object({
  template: z.enum(['one', 'two', 'three', 'four', 'spread-one']),
  cells: z.array(cellSchema).max(60),
  copies: z.number().int().positive().optional(),
  bg: z.string().max(20).optional(),
  texts: z.array(pageTextSchema).max(20).optional(),
  // Отступы страницы (доля ширины): заменяют поле и зазор темы.
  gap: z.number().min(0).max(0.12).optional(),
});
export const coverSchema = z.object({
  photoId: z.string().nullable(),
  title: z.string().max(100),
  subtitle: z.string().max(100).optional(),
  spine: z.string().max(60).optional(),
  color: z.string().max(20).optional(),
});
// themeId и cover необязательны: старые макеты без них рисуются в теме по умолчанию и с первой страницей на обложке.
export const layoutSchema = z.object({
  pages: z.array(pageSchema),
  themeId: z.string().optional(),
  cover: coverSchema.optional(),
  // Фото, которые раскладка уже учла: новые (ещё не учтённые) добавляются в книгу, а убранные пользователем не возвращаются.
  seen: z.array(z.string()).max(5000).optional(),
});
// Список допустимых id тем (для проверки выбора); сам макет хранит themeId строкой, чтобы старые и будущие темы не ломали чтение.
export const themeIdSchema = z.enum(['minimal', 'film', 'travel', 'holiday', 'graduation']);

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
export const productLineSchema = z.enum(['photo', 'digital']).nullable();
export const productSchema = z.object({
  id: z.string(),
  kind: z.enum(['photobook', 'prints', 'graduation']),
  line: productLineSchema,
  title: z.string(),
  description: z.string(),
  variants: z.array(variantSchema),
});
export const pickupPointSchema = z.object({
  id: z.string(),
  title: z.string(),
  address: z.string(),
});
export const deliveryOptionSchema = z.object({
  id: deliveryMethodIdSchema,
  title: z.string(),
  priceKop: kop,
  freeFromKop: kop.nullable(),
  etaDays: z.tuple([z.number().int(), z.number().int()]),
  payOnDelivery: z.boolean(),
  pickupPoints: z.array(pickupPointSchema).optional(),
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
  uploadedBy: z.string().nullable(),
  source: z.enum(['gallery', 'ai']),
});

export const projectSchema = z.object({
  id: z.string(),
  title: z.string(),
  variantId: z.string(),
  ownerId: z.string(),
  status: z.enum(['draft', 'ordered']),
  isShared: z.boolean(),
  expectedMembers: z.number().int().nonnegative().nullable(),
  hasPassword: z.boolean(),
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

export const orderAddressSchema = z
  .object({
    recipient: z.string().min(1),
    phone: z.string().min(1),
    city: z.string().min(1),
    street: z.string().optional(),
    postalCode: z.string().optional(),
    pickupPointId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.pickupPointId && (!data.street || data.street.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['street'],
        message: 'Укажите улицу или пункт выдачи заказа',
      });
    }
  });
export const createOrderRequestSchema = z.object({
  projectId: z.string().uuid(),
  delivery: deliveryMethodIdSchema,
  promoCode: z.string().optional(),
  expectedTotalKop: kop,
  address: orderAddressSchema.optional(),
  payment: paymentMethodSchema.optional().default('card'),
});

export const orderSchema = z.object({
  id: z.string(),
  number: z.string(),
  projectId: z.string().nullable(),
  status: orderStatusSchema,
  totalKop: kop,
  currency: z.literal('BYN'),
  delivery: deliveryMethodIdSchema,
  payment: paymentMethodSchema,
  eripNumber: z.string().nullable(),
  createdAt: iso,
  history: z.array(z.object({ status: orderStatusSchema, at: iso, note: z.string().optional() })),
  interactionIds: z.array(z.string()),
});

export const interactionMessageSchema = z.object({
  id: z.string(),
  authorId: z.string().nullable(),
  authorRole: z.enum(['customer', 'operator']).nullable(),
  body: z.string(),
  createdAt: iso,
  attachmentUrl: z.string().nullable(),
});
export const interactionSchema = z.object({
  id: z.string(),
  orderId: z.string().nullable(),
  customerId: z.string().nullable(),
  topic: z.string(),
  status: z.enum(['open', 'answered', 'closed']),
  createdAt: iso,
  messages: z.array(interactionMessageSchema),
});
export const inviteSchema = z.object({ token: z.string(), url: z.string(), expiresAt: iso });
export const acceptInviteRequestSchema = z.object({
  token: z.string().min(10).max(200),
  childName: z.string().trim().min(1).max(100).optional(),
  // Пароль сравнивается как есть, без обрезки пробелов.
  password: z.string().max(200).optional(),
});
export const albumMemberSchema = z.object({
  userId: z.string(),
  childName: z.string().nullable(),
  role: z.enum(['organizer', 'contributor']),
  photosCount: z.number().int().nonnegative(),
});
export const albumProgressSchema = z.object({
  expected: z.number().int().nonnegative().nullable(),
  members: z.array(albumMemberSchema),
});

export const aiEditKindSchema = z.enum(['edit', 'upscale']);

export const aiEditRequestSchema = z.object({
  // Не uuid проверяет сервис и отвечает 404: чужой и битый id не отличаются.
  projectId: z.string(),
  photoId: z.string(),
  prompt: z.string().trim().min(1).max(500),
  kind: aiEditKindSchema.optional().default('edit'),
  aspect: z.enum(ASPECT_RATIOS).optional(),
});

export const aiJobSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'done', 'failed']),
  kind: aiEditKindSchema.optional(),
  reason: z.string().optional(),
  resultPhoto: photoSchema.optional(),
});

/** Множители относительно нейтрали (1 = без изменений). */
export const aiAdjustRequestSchema = z.object({
  // Не uuid проверяет сервис и отвечает 404: чужой и битый id не отличаются.
  projectId: z.string(),
  photoId: z.string(),
  brightness: z.number().min(0.5).max(1.5).optional(),
  contrast: z.number().min(0.5).max(1.5).optional(),
  saturation: z.number().min(0).max(2).optional(),
  sharpen: z.number().min(0).max(5).optional(),
});

export const aiChatRoleSchema = z.enum(['user', 'assistant']);
export const aiChatMessageSchema = z.object({
  role: aiChatRoleSchema,
  content: z.string().trim().min(1).max(4000),
});
export const aiChatRequestSchema = z.object({
  messages: z.array(aiChatMessageSchema).min(1).max(40),
  orderId: z.string().uuid().optional(),
});
export const aiChatResponseSchema = z.object({
  reply: z.string(),
  messages: z.array(aiChatMessageSchema),
});

export const apiErrorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.record(z.unknown()).optional() }),
});

export const auditEntrySchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  at: iso,
  action: z.string(),
  objectType: z.string().nullable(),
  objectId: z.string().nullable(),
  result: z.enum(['ok', 'denied', 'error']),
});

export const dataSummarySchema = z.object({
  projects: z.number().int().nonnegative(),
  photos: z.number().int().nonnegative(),
  orders: z.number().int().nonnegative(),
  aiConsentAt: iso.nullable(),
});
