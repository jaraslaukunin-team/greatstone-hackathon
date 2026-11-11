import { eq } from 'drizzle-orm';
import { calcPrice, normalizePromoCode, type QuoteRequest, type QuoteResponse } from '@picpac/shared';
import type { Db } from '../../db/client.js';
import { productVariants, promoCodes } from '../../db/schema.js';
import { AppError } from '../../errors.js';

export type VariantRow = typeof productVariants.$inferSelect;

export async function loadVariant(db: Db, id: string): Promise<VariantRow> {
  const [v] = await db.select().from(productVariants).where(eq(productVariants.id, id));
  if (!v) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Вариант продукта не найден');
  return v;
}

// Пустой код (в том числе из одних пробелов) промокодом не считается.
export async function resolvePromo(
  db: Db,
  raw: string | undefined,
  now: Date,
): Promise<{ discountPercent: number; applied: boolean }> {
  const code = normalizePromoCode(raw ?? '');
  if (code === '') return { discountPercent: 0, applied: false };
  const [p] = await db.select().from(promoCodes).where(eq(promoCodes.code, code));
  if (!p) throw new AppError(422, 'PROMO_UNKNOWN', 'Такого промокода нет');
  if (p.validUntil.getTime() < now.getTime()) {
    throw new AppError(422, 'PROMO_EXPIRED', 'Срок действия промокода истёк');
  }
  return { discountPercent: p.discountPercent, applied: true };
}

export function assertPagesInRange(variant: VariantRow, pages: number): void {
  if (pages < variant.pagesMin || pages > variant.pagesMax) {
    throw new AppError(
      422,
      'PAGES_OUT_OF_RANGE',
      `Для этого варианта допустимо от ${variant.pagesMin} до ${variant.pagesMax} страниц`,
    );
  }
}

// Единственное место, где API считает цену: заказ (A8) вызывает ту же функцию.
export async function computeQuote(db: Db, req: QuoteRequest, now: Date): Promise<QuoteResponse> {
  const variant = await loadVariant(db, req.variantId);
  assertPagesInRange(variant, req.pages);
  const promo = await resolvePromo(db, req.promoCode, now);
  const price = calcPrice({
    variant: {
      basePriceKop: variant.basePrice,
      pricePerPageKop: variant.pricePerPage,
      pagesMin: variant.pagesMin,
    },
    pages: req.pages,
    quantity: req.quantity,
    discountPercent: promo.discountPercent,
    delivery: req.delivery,
  });
  return { ...price, currency: 'BYN', promoApplied: promo.applied };
}
