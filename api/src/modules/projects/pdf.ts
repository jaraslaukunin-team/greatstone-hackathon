import { readFile } from 'node:fs/promises';
import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import PDFDocument from 'pdfkit';
import qrcode from 'qrcode-generator';
import sharp from 'sharp';
import { cellRects, fitRect, themeById, timelineAnchors, timelineCurves, type Layout, type Page } from '@picpac/shared';
import type { AuthUser } from '../../auth/plugin.js';
import { projectPhotos, productVariants } from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { storageKey } from '../photos/service.js';
import { assertProjectAccess } from './service.js';

const textSize = { title: 0.075, caption: 0.045, date: 0.04, quote: 0.052 };
const font = new URL('../../../assets/FuturaPT-Book.ttf', import.meta.url);
const safeColor = (value: string | undefined, fallback: string) => value && /^#[a-f\d]{3}(?:[a-f\d]{3})?$/i.test(value) ? value : fallback;

export async function exportProjectPdf(app: FastifyInstance, user: AuthUser, id: string): Promise<Buffer> {
  const project = await assertProjectAccess(app.db, user, id, user.role === 'operator' ? 'read' : 'organizer');
  const layout = project.layout as Layout | null;
  if (!layout?.pages.length || project.isPool) throw new AppError(422, 'LAYOUT_EMPTY', 'Сначала соберите макет книги');
  const [variant] = await app.db.select().from(productVariants).where(eq(productVariants.id, project.variantId));
  if (!variant) throw new AppError(404, 'VARIANT_NOT_FOUND', 'Формат не найден');
  const dimensions = /(\d+(?:[.,]\d+)?)\s*[×xх]\s*(\d+(?:[.,]\d+)?)/i.exec(variant.format.trim());
  const cm = (value: string) => Number(value.replace(',', '.')) * 72 / 2.54;
  const width = dimensions ? cm(dimensions[1]!) : variant.pageWidthCm * 72 / 2.54;
  const height = dimensions ? cm(dimensions[2]!) : width;

  if (layout.pages.length > variant.pagesMax) throw new AppError(422, 'PAGES_OUT_OF_RANGE', 'В макете слишком много страниц для этого формата');
  const photoIds = [...new Set([layout.cover?.photoId, ...layout.pages.flatMap((page) => page.cells.map((cell) => cell.photoId))]
    .filter((value): value is string => !!value && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)))];
  const rows = photoIds.length ? await app.db.select().from(projectPhotos)
    .where(and(eq(projectPhotos.projectId, id), inArray(projectPhotos.id, photoIds))) : [];
  const photos = new Map(rows.map((row) => [row.id, row]));
  const theme = themeById(layout.themeId);
  const doc = new PDFDocument({ autoFirstPage: false, margin: 0, info: { Title: project.title } });
  const chunks: Buffer[] = [];
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.once('end', () => resolve(Buffer.concat(chunks)));
    doc.once('error', reject);
  });
  doc.font(await readFile(font));
  const normalized = new Map<string, Buffer>();
  for (const [index, sheet] of layout.pages.entries()) {
    const cover = index === 0 ? layout.cover : undefined;
    const page: Page = cover?.photoId ? {
      template: 'spread-one', cells: [{ photoId: cover.photoId, fit: 'cover', crop: { x: 0, y: 0, scale: 1, rotation: 0 } }],
    } : sheet;
    doc.addPage({ size: [width, height], margin: 0 });
    doc.rect(0, 0, width, height).fill(safeColor(cover?.color ?? page.bg, theme.pageBg));
    if (page.timeline) {
      const { start, first, second, end } = timelineCurves[page.timeline];
      doc.moveTo(start[0] * width, start[1] * height)
        .bezierCurveTo(first[0] * width, first[1] * height, second[0] * width, second[1] * height, end[0] * width, end[1] * height)
        .lineWidth(width * 0.012).strokeColor(theme.textColor).stroke();
      const stops = page.texts?.filter((text) => text.style === 'date').length ?? 0;
      timelineAnchors(page.timeline).slice(0, stops).forEach(([x, y], index) => {
        doc.moveTo(x! * width, y! * height).lineTo(x! * width, height * (index === 0 ? 0.44 : 0.65))
          .lineWidth(width * 0.006).stroke();
        doc.circle(x! * width, y! * height, width * 0.016).fill(theme.textColor);
      });
    }
    const rects = cellRects(page.template, width, height, page.cells.length, theme, page.gap);
    for (const [slot, cell] of page.cells.entries()) {
      const photo = cell.photoId ? photos.get(cell.photoId) : undefined;
      if (!photo || cell.hidden) continue;
      const f = cell.frame;
      const box = f ? { x: (f.x - f.w / 2) * width, y: (f.y - f.h / 2) * height, width: f.w * width, height: f.h * height } : rects[slot];
      if (!box) continue;
      let image = normalized.get(photo.id);
      if (!image) {
        const data = await app.storage.get(storageKey(id, photo.id));
        image = await sharp(data).autoOrient().resize({ width: 3200, height: 3200, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
        normalized.set(photo.id, image);
      }
      const side = !f && theme.frame === 'polaroid' ? box.width * 0.06 : 0;
      const bottom = side ? box.height * 0.16 : 0;
      const inner = { x: box.x + side, y: box.y + side, width: box.width - side * 2, height: box.height - side - bottom };
      const fit = fitRect(photo, inner, cell.fit ?? 'contain');
      const scale = Math.max(1, cell.crop.scale);
      const w = fit.width * scale;
      const h = fit.height * scale;
      doc.save();
      if (f?.rot) doc.rotate(f.rot, { origin: [box.x + box.width / 2, box.y + box.height / 2] });
      if (side || cell.border) doc.rect(box.x, box.y, box.width, box.height).fill(cell.border ? '#FFFFFF' : theme.frameColor);
      doc.save().rect(inner.x, inner.y, inner.width, inner.height).clip()
        .image(image, inner.x + fit.x + (fit.width - w) / 2 + cell.crop.x * inner.width,
          inner.y + fit.y + (fit.height - h) / 2 + cell.crop.y * inner.height, { width: w, height: h })
        .restore();
      if ((!f && theme.frame === 'thin') || cell.border) doc.rect(box.x, box.y, box.width, box.height).lineWidth(cell.border ? 2 : 1).strokeColor(cell.border ? '#FFFFFF' : theme.frameColor).stroke();
      doc.restore();
    }
    if (page.qr) {
      const { url, x, y, size } = page.qr;
      const code = qrcode(0, 'M');
      code.addData(url);
      code.make();
      const count = code.getModuleCount();
      const unit = size * width / (count + 8);
      const left = x * width - size * width / 2;
      const top = y * height - size * width / 2;
      doc.rect(left, top, size * width, size * width).fill('#FFFFFF');
      for (let row = 0; row < count; row++) for (let col = 0; col < count; col++) {
        if (code.isDark(row, col)) doc.rect(left + (col + 4) * unit, top + (row + 4) * unit, unit, unit).fill('#000000');
      }
    }
    const captions = cover?.title ? [
      ...(cover.photoId ? [] : (page.texts ?? []).filter((text) => text.text !== cover.title)),
      { text: cover.title, x: 0.5, y: 0.73, style: 'title' as const },
      ...(cover.subtitle ? [{ text: cover.subtitle, x: 0.5, y: 0.85, style: 'caption' as const }] : []),
    ] : page.texts ?? [];
    for (const text of captions) {
      if (text.hidden) continue;
      const size = textSize[text.style] * width;
      const span = width * (page.timeline ? 0.46 : 0.8);
      const left = Math.min(width - span, Math.max(0, text.x * width - span / 2));
      const top = Math.max(0, text.y * height - size * 0.7);
      doc.save();
      if (text.rot) doc.rotate(text.rot, { origin: [text.x * width, text.y * height] });
      doc.fontSize(size).fillColor(theme.textColor)
        .text(text.text, left, top, { width: span, height: Math.min(size * 4, height - top), align: 'center', ellipsis: true });
      doc.restore();
    }
  }
  doc.end();
  return finished;
}
