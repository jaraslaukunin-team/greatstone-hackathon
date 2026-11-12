import { asc, eq } from 'drizzle-orm';
import { DELIVERY_METHODS, type CatalogDTO, type DeliveryOptionDTO, type PickupPoint, type ProductDTO } from '@picpac/shared';
import type { Db } from '../../db/client.js';
import { productVariants, products } from '../../db/schema.js';

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

/** Синтетические пункты выдачи Белпочты (статический список, без БД). */
export const BELPOST_PICKUP_POINTS: PickupPoint[] = [
  { id: 'pp-minsk-1', title: 'Белпочта №1 (Минск)', address: 'ул. Ленина, 10, Минск' },
  { id: 'pp-minsk-2', title: 'Белпочта №2 (Минск)', address: 'пр. Независимости, 25, Минск' },
  { id: 'pp-brest-1', title: 'Белпочта (Брест)', address: 'ул. Советская, 5, Брест' },
  { id: 'pp-grodno-1', title: 'Белпочта (Гродно)', address: 'ул. Советская, 12, Гродно' },
  { id: 'pp-vitebsk-1', title: 'Белпочта (Витебск)', address: 'ул. Ленина, 3, Витебск' },
  { id: 'pp-gomel-1', title: 'Белпочта (Гомель)', address: 'пр. Ленина, 1, Гомель' },
];

export const BELPOST_PICKUP_IDS = new Set(BELPOST_PICKUP_POINTS.map((p) => p.id));

type ProductRow = typeof products.$inferSelect;
type VariantRow = typeof productVariants.$inferSelect;

const toProduct = (p: ProductRow, variants: VariantRow[]): ProductDTO => ({
  id: p.id,
  kind: p.kind,
  title: p.title,
  description: p.description,
  variants: variants
    .filter((v) => v.productId === p.id)
    .sort((a, b) => a.basePrice - b.basePrice || a.pricePerPage - b.pricePerPage || a.format.localeCompare(b.format))
    .map((v) => ({
      id: v.id,
      productId: v.productId,
      format: v.format,
      pagesMin: v.pagesMin,
      pagesMax: v.pagesMax,
      basePriceKop: v.basePrice,
      pricePerPageKop: v.pricePerPage,
      minDpi: v.minDpi,
      pageWidthCm: v.pageWidthCm,
      leadTimeDays: p.leadTimeDays,
    })),
});

export async function getCatalog(db: Db): Promise<CatalogDTO> {
  const [productRows, variantRows] = await Promise.all([
    db.select().from(products).orderBy(asc(products.title)),
    db.select().from(productVariants),
  ]);
  const delivery: DeliveryOptionDTO[] = DELIVERY_METHODS.map((d) => {
    if (d.id === 'belpost') {
      return { ...d, pickupPoints: [...BELPOST_PICKUP_POINTS] };
    }
    return { ...d };
  });
  return {
    products: productRows.map((p) => toProduct(p, variantRows)),
    delivery,
    limits: { maxPhotoBytes: MAX_PHOTO_BYTES, allowedMimeTypes: [...ALLOWED_MIME_TYPES] },
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Невалидный id не уходит в БД: приведение к uuid упало бы с 500.
export async function getProduct(db: Db, id: string): Promise<ProductDTO | null> {
  if (!UUID.test(id)) return null;
  const [p] = await db.select().from(products).where(eq(products.id, id));
  if (!p) return null;
  const variants = await db.select().from(productVariants).where(eq(productVariants.productId, id));
  return toProduct(p, variants);
}
