import { autoLayout, type PhotoMeta } from './layout';
import { httpsUrlSchema } from './schemas';
import type { Cell, Layout, Page } from './types';

export type AlbumMemberInput = { userId: string; childName: string | null; wish: string | null; videoUrl: string | null };
export type AlbumPhotoInput = PhotoMeta & { uploadedBy: string | null };

const MAX_CLASS_PAGES = 8;
const PERSONAL_PHOTOS = 3;
const neutral = (): Cell['crop'] => ({ x: 0, y: 0, scale: 1, rotation: 0 });
const cellFor = (photoId: string | null): Cell => ({ photoId, crop: neutral() });
const evenFloor = (n: number) => Math.max(0, n - (n % 2));
const evenCeil = (n: number) => Math.max(0, n + (n % 2));

/** Фото участника в порядке съёмки (без даты — в конце), не больше трёх. */
function ownPhotos(photos: AlbumPhotoInput[], userId: string): AlbumPhotoInput[] {
  const time = (p: AlbumPhotoInput) => {
    const t = p.takenAt === null ? NaN : Date.parse(p.takenAt);
    return Number.isFinite(t) ? t : Infinity;
  };
  return photos
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.uploadedBy === userId)
    .sort((a, b) => (time(a.p) === time(b.p) ? a.i - b.i : time(a.p) - time(b.p)))
    .map(({ p }) => p)
    .slice(0, PERSONAL_PHOTOS);
}

/**
 * Автосборка выпускного альбома: обложка, вводная страница, общие развороты и по два листа на каждого участника
 * (слева его фото, справа имя, пожелание и QR на видео). Участники — по алфавиту; не поместившиеся в pagesMax
 * попадают в skipped, общие развороты при нехватке места сокращаются первыми. Число страниц всегда нечётное:
 * вводная лежит одна справа от обложки, дальше идут полные пары.
 */
export function buildAlbumLayout(
  input: { title: string; members: AlbumMemberInput[]; photos: AlbumPhotoInput[] },
  limits: { pagesMin: number; pagesMax: number },
): { layout: Layout; skipped: string[] } {
  const sorted = [...input.members].sort((a, b) => (a.childName ?? '').localeCompare(b.childName ?? '', 'ru'));
  const fit = Math.max(0, Math.floor((limits.pagesMax - 1) / 2));
  const used = sorted.slice(0, fit);
  const skipped = sorted.slice(fit).map((m) => m.userId);

  const budget = evenFloor(limits.pagesMax - 1 - 2 * used.length);
  const need = evenCeil(limits.pagesMin - 1 - 2 * used.length);
  const classPages = Math.min(budget, Math.max(Math.min(MAX_CLASS_PAGES, budget), need));

  const first = input.photos[0] ?? null;
  const pages: Page[] = [
    {
      template: 'one',
      cells: [cellFor(first?.id ?? null)],
      texts: [{ text: input.title, x: 0.5, y: 0.9, style: 'title' }],
    },
  ];

  if (classPages > 0) {
    const klass = autoLayout(input.photos, { pagesMin: classPages, pagesMax: classPages }).pages;
    pages.push(...klass.slice(0, classPages));
  }

  for (const m of used) {
    const own = ownPhotos(input.photos, m.userId);
    const template: Page['template'] = own.length >= 3 ? 'three' : own.length === 2 ? 'two' : 'one';
    const cells = own.length === 0 ? [cellFor(null)] : own.map((p) => cellFor(p.id));
    pages.push({ template, cells, memberId: m.userId });

    const texts: NonNullable<Page['texts']> = [{ text: m.childName?.trim() || 'Выпускник', x: 0.5, y: 0.14, style: 'title' }];
    const wish = m.wish?.trim();
    if (wish) texts.push({ text: wish, x: 0.5, y: 0.42, style: 'quote' });
    const right: Page = { template: 'one', cells: [], texts, memberId: m.userId };
    if (m.videoUrl && httpsUrlSchema.safeParse(m.videoUrl).success) {
      right.qr = { url: m.videoUrl, x: 0.5, y: 0.74, size: 0.3 };
    }
    pages.push(right);
  }

  const layout: Layout = {
    pages,
    cover: { photoId: first?.id ?? null, title: input.title, subtitle: 'Выпускной альбом' },
  };
  return { layout, skipped };
}

/**
 * Именная копия: имя ученика в подзаголовке обложки, а его разворот (пара страниц с его memberId) идёт первым
 * после вводной страницы, то есть на позициях 1–2. Фото и число страниц не меняются; без имени макет остаётся прежним.
 */
export function personalizeLayout(layout: Layout, userId: string, childName: string | null): Layout {
  const name = childName?.trim();
  if (!name) return layout;
  const next = JSON.parse(JSON.stringify(layout)) as Layout;
  next.cover = { photoId: null, title: '', ...next.cover, subtitle: name.slice(0, 100) };
  const i = next.pages.findIndex((p) => p.memberId === userId);
  if (i > 1) {
    const pairEnd = next.pages[i + 1]?.memberId === userId ? i + 2 : i + 1;
    const pair = next.pages.splice(i, pairEnd - i);
    next.pages.splice(1, 0, ...pair);
  }
  return next;
}
