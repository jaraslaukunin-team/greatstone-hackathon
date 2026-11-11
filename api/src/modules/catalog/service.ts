import { asc, eq } from 'drizzle-orm';
import { DELIVERY_METHODS, type CatalogDTO, type ProductDTO } from '@picpac/shared';
import type { Db } from '../../db/client.js';
import { productVariants, products } from '../../db/schema.js';

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

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
  return {
    products: productRows.map((p) => toProduct(p, variantRows)),
    delivery: DELIVERY_METHODS.map((d) => ({ ...d })),
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
