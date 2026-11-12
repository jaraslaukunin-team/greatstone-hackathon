import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Деньги везде целые копейки (BYN), время везде timestamptz.
const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const createdAt = () => ts('created_at').notNull().defaultNow();

export const roleEnum = pgEnum('role', ['customer', 'operator']);
export const productKindEnum = pgEnum('product_kind', ['photobook', 'prints', 'graduation']);
export const productLineEnum = pgEnum('product_line', ['photo', 'digital']);
export const projectStatusEnum = pgEnum('project_status', ['draft', 'ordered']);
export const photoSourceEnum = pgEnum('photo_source', ['gallery', 'ai']);
export const memberRoleEnum = pgEnum('member_role', ['organizer', 'contributor']);
export const orderStatusEnum = pgEnum('order_status', [
  'accepted',
  'moderation',
  'production',
  'ready_for_delivery',
  'completed',
  'cancelled',
]);
export const deliveryMethodEnum = pgEnum('delivery_method', ['courier_minsk', 'ems', 'belpost']);
export const paymentMethodEnum = pgEnum('payment_method', ['card', 'erip', 'courier']);
export const interactionStatusEnum = pgEnum('interaction_status', ['open', 'answered', 'closed']);
export const aiJobStatusEnum = pgEnum('ai_job_status', ['pending', 'done', 'failed']);
export const consentKindEnum = pgEnum('consent_kind', ['ai_processing']);

export const orderNumberSeq = pgSequence('order_number_seq');

export const profiles = pgTable('profiles', {
  id: id(),
  role: roleEnum('role').notNull().default('customer'),
  displayName: text('display_name').notNull(),
  isGuest: boolean('is_guest').notNull().default(false),
  // Email или телефон для входа по коду.
  contact: text('contact').unique(),
  createdAt: createdAt(),
});

export const authCodes = pgTable(
  'auth_codes',
  {
    id: id(),
    contact: text('contact').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    usedAt: ts('used_at'),
    createdAt: createdAt(),
  },
  (t) => [index('auth_codes_contact_idx').on(t.contact)],
);

export const products = pgTable('products', {
  id: id(),
  kind: productKindEnum('kind').notNull(),
  /** Линейка печати: 'photo' — фотопечать, 'digital' — цифровая, null — не применимо (книги). */
  line: productLineEnum('line'),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  leadTimeDays: integer('lead_time_days').notNull(),
});

export const productVariants = pgTable(
  'product_variants',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    format: text('format').notNull(),
    pagesMin: integer('pages_min').notNull(),
    pagesMax: integer('pages_max').notNull(),
    basePrice: integer('base_price').notNull(),
    pricePerPage: integer('price_per_page').notNull(),
    pageWidthCm: integer('page_width_cm').notNull(),
    minDpi: integer('min_dpi').notNull().default(150),
  },
  (t) => [
    index('product_variants_product_idx').on(t.productId),
    check('product_variants_pages_chk', sql`${t.pagesMin} <= ${t.pagesMax}`),
    check('product_variants_width_chk', sql`${t.pageWidthCm} > 0`),
    check('product_variants_pages_min_chk', sql`${t.pagesMin} >= 0`),
    check('product_variants_base_price_chk', sql`${t.basePrice} >= 0`),
    check('product_variants_price_per_page_chk', sql`${t.pricePerPage} >= 0`),
    check('product_variants_min_dpi_chk', sql`${t.minDpi} > 0`),
  ],
);

export const promoCodes = pgTable(
  'promo_codes',
  {
    id: id(),
    code: text('code').notNull().unique(),
    discountPercent: integer('discount_percent').notNull(),
    validUntil: ts('valid_until').notNull(),
  },
  (t) => [check('promo_codes_percent_chk', sql`${t.discountPercent} between 0 and 100`)],
);

export const projects = pgTable(
  'projects',
  {
    id: id(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id),
    title: text('title').notNull().default(''),
    status: projectStatusEnum('status').notNull().default('draft'),
    layout: jsonb('layout'),
    isShared: boolean('is_shared').notNull().default(false),
    /** Общий пул фото события (не заказной); личные книги ссылаются через sourceProjectId. */
    isPool: boolean('is_pool').notNull().default(false),
    // FK на projects(id) ON DELETE SET NULL — в миграции 0011 (self-ref в drizzle ломает вывод типов).
    sourceProjectId: uuid('source_project_id'),
    expectedMembers: integer('expected_members'),
    // scrypt-хеш пароля входа в общий альбом (соль:хеш); null — вход по одному приглашению.
    joinPasswordHash: text('join_password_hash'),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('projects_owner_idx').on(t.ownerId),
    index('projects_variant_idx').on(t.variantId),
    uniqueIndex('projects_owner_source_uq')
      .on(t.ownerId, t.sourceProjectId)
      .where(sql`${t.sourceProjectId} is not null`),
    check('projects_expected_members_chk', sql`${t.expectedMembers} is null or ${t.expectedMembers} >= 0`),
  ],
);

export const projectPhotos = pgTable(
  'project_photos',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by').references(() => profiles.id, { onDelete: 'set null' }),
    storagePath: text('storage_path').notNull(),
    position: integer('position').notNull().default(0),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    takenAt: ts('taken_at'),
    source: photoSourceEnum('source').notNull().default('gallery'),
    /** SHA-256 содержимого файла; для старых загрузок может быть null. */
    contentHash: text('content_hash'),
    /** Фото пула, из которого скопирована эта запись (личная книга). */
    sourcePhotoId: uuid('source_photo_id'),
    createdAt: createdAt(),
  },
  (t) => [index('project_photos_project_idx').on(t.projectId)],
);

export const projectMembers = pgTable(
  'project_members',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: memberRoleEnum('role').notNull(),
    childName: text('child_name'),
    // Пожелание ученика классу и ссылка на видео-поздравление (https): печатаются на его развороте.
    wish: text('wish'),
    videoUrl: text('video_url'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('project_members_project_user_uq').on(t.projectId, t.userId),
    index('project_members_user_idx').on(t.userId),
  ],
);

export const projectInvites = pgTable(
  'project_invites',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('project_invites_project_idx').on(t.projectId)],
);

export const orders = pgTable(
  'orders',
  {
    id: id(),
    number: text('number')
      .notNull()
      .unique()
      .default(sql`'PP-' || lpad(nextval('order_number_seq')::text, 6, '0')`),
    // NULL после анонимизации при удалении аккаунта.
    customerId: uuid('customer_id').references(() => profiles.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    idempotencyKey: text('idempotency_key').notNull(),
    requestHash: text('request_hash').notNull(),
    total: integer('total').notNull(),
    currency: text('currency').notNull().default('BYN'),
    deliveryMethod: deliveryMethodEnum('delivery_method').notNull(),
    paymentMethod: paymentMethodEnum('payment_method').notNull().default('card'),
    favorite: boolean('favorite').notNull().default(false),
    eripNumber: text('erip_number'),
    recipientName: text('recipient_name'),
    address: text('address'),
    status: orderStatusEnum('status').notNull().default('accepted'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('orders_customer_idempotency_uq').on(t.customerId, t.idempotencyKey),
    index('orders_customer_idx').on(t.customerId),
    index('orders_project_idx').on(t.projectId),
    check('orders_total_chk', sql`${t.total} >= 0`),
  ],
);

export const orderStatusHistory = pgTable(
  'order_status_history',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    status: orderStatusEnum('status').notNull(),
    changedBy: uuid('changed_by').references(() => profiles.id, { onDelete: 'set null' }),
    changedAt: ts('changed_at').notNull().defaultNow(),
    comment: text('comment'),
  },
  (t) => [index('order_status_history_order_idx').on(t.orderId)],
);

export const interactions = pgTable(
  'interactions',
  {
    id: id(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    customerId: uuid('customer_id').references(() => profiles.id, { onDelete: 'set null' }),
    topic: text('topic').notNull(),
    status: interactionStatusEnum('status').notNull().default('open'),
    createdAt: createdAt(),
  },
  (t) => [
    index('interactions_customer_idx').on(t.customerId),
    index('interactions_order_idx').on(t.orderId),
  ],
);

export const interactionMessages = pgTable(
  'interaction_messages',
  {
    id: id(),
    interactionId: uuid('interaction_id')
      .notNull()
      .references(() => interactions.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => profiles.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    /** Storage key для вложенного изображения; null — без вложения. */
    attachmentKey: text('attachment_key'),
    createdAt: createdAt(),
  },
  (t) => [index('interaction_messages_interaction_idx').on(t.interactionId)],
);

export const aiJobs = pgTable(
  'ai_jobs',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sourcePhoto: text('source_photo').notNull(),
    prompt: text('prompt').notNull(),
    size: text('size'),
    resultPath: text('result_path'),
    resultPhotoId: uuid('result_photo_id').references(() => projectPhotos.id, { onDelete: 'set null' }),
    reason: text('reason'),
    status: aiJobStatusEnum('status').notNull().default('pending'),
    provider: text('provider').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('ai_jobs_user_idx').on(t.userId), index('ai_jobs_user_created_idx').on(t.userId, t.createdAt)],
);

export const consents = pgTable(
  'consents',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    kind: consentKindEnum('kind').notNull(),
    acceptedAt: ts('accepted_at').notNull().defaultNow(),
  },
  (t) => [unique('consents_user_kind_uq').on(t.userId, t.kind)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    // Без внешнего ключа: журнал переживает удаление пользователя.
    userId: uuid('user_id'),
    at: ts('at').notNull().defaultNow(),
    action: text('action').notNull(),
    objectType: text('object_type'),
    objectId: text('object_id'),
    result: text('result').notNull(),
  },
  (t) => [index('audit_log_at_idx').on(t.at), index('audit_log_user_idx').on(t.userId)],
);
