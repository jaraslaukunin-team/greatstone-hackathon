import { autoLayout, type PhotoMeta } from './layout';
import type { Layout, Page, PageText } from './types';

export type EventPhotoInput = PhotoMeta & { uploadedBy: string | null; authorName: string | null };

const SERIES_MS = 3000;

function pixels(p: PhotoMeta): number {
  return p.width * p.height;
}

function parseTime(takenAt: string | null): number | null {
  if (takenAt === null) return null;
  const t = Date.parse(takenAt);
  return Number.isFinite(t) ? t : null;
}

/** UTC-ключ дня или null («Без даты»). */
function dayKey(takenAt: string | null): string | null {
  const t = parseTime(takenAt);
  if (t === null) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function formatChapterTitle(day: string | null): string {
  if (day === null) return 'Без даты';
  const label = new Date(`${day}T12:00:00.000Z`).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Серии одного автора с интервалом ≤ 3 с → одно фото (больше пикселей). */
export function collapseSeries(photos: EventPhotoInput[]): EventPhotoInput[] {
  const indexed = photos.map((photo, index) => ({ photo, index }));
  indexed.sort((a, b) => {
    const ta = parseTime(a.photo.takenAt);
    const tb = parseTime(b.photo.takenAt);
    if (ta === null && tb === null) return a.index - b.index;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta === tb ? a.index - b.index : ta - tb;
  });

  const out: EventPhotoInput[] = [];
  for (const { photo } of indexed) {
    const prev = out[out.length - 1];
    if (!prev) {
      out.push(photo);
      continue;
    }
    const tPrev = parseTime(prev.takenAt);
    const tCur = parseTime(photo.takenAt);
    const sameAuthor =
      prev.uploadedBy !== null && photo.uploadedBy !== null && prev.uploadedBy === photo.uploadedBy;
    if (sameAuthor && tPrev !== null && tCur !== null && tCur - tPrev <= SERIES_MS) {
      if (pixels(photo) > pixels(prev)) out[out.length - 1] = photo;
      continue;
    }
    out.push(photo);
  }
  return out;
}

function groupByDay(photos: EventPhotoInput[]): { day: string | null; photos: EventPhotoInput[] }[] {
  const map = new Map<string | null, EventPhotoInput[]>();
  for (const p of photos) {
    const key = dayKey(p.takenAt);
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  const dated = [...map.entries()]
    .filter(([k]) => k !== null)
    .sort(([a], [b]) => (a! < b! ? -1 : 1))
    .map(([day, list]) => ({ day, photos: list }));
  const undated = map.get(null);
  if (undated?.length) dated.push({ day: null, photos: undated });
  return dated;
}

function authorCaption(page: Page, byId: Map<string, EventPhotoInput>): PageText | null {
  const ids = page.cells.map((c) => c.photoId).filter((id): id is string => id !== null);
  if (ids.length === 0) return null;
  const names = new Set<string>();
  for (const id of ids) {
    const name = byId.get(id)?.authorName?.trim();
    if (!name) return null;
    names.add(name);
  }
  if (names.size !== 1) return null;
  const name = [...names][0]!;
  return { text: `Фото: ${name}`, x: 0.5, y: 0.95, style: 'caption' };
}

/**
 * Книга общего альбома: вводная, главы по дням съёмки, автомакет внутри главы.
 * omitted — фото после схлопывания серий, не попавшие в pagesMax.
 */
export function buildEventLayout(
  photos: EventPhotoInput[],
  opts: { title: string; limits: { pagesMin: number; pagesMax: number } },
): { layout: Layout; omitted: number } {
  const title = opts.title.slice(0, 100);
  const collapsed = collapseSeries(photos);
  const chapters = groupByDay(collapsed);
  const chapterCount = chapters.length;
  const reserved = 1 + chapterCount;
  let photoBudget = Math.max(0, opts.limits.pagesMax - reserved);
  const photoMinTotal = Math.max(0, opts.limits.pagesMin - reserved);

  const byId = new Map(collapsed.map((p) => [p.id, p]));
  const first = collapsed[0] ?? null;
  const intro: Page = {
    template: 'one',
    cells: [{ photoId: first?.id ?? null, crop: { x: 0, y: 0, scale: 1, rotation: 0 } }],
    texts: [{ text: title, x: 0.5, y: 0.9, style: 'title' }],
  };
  const introCaption = authorCaption(intro, byId);
  if (introCaption) intro.texts = [...(intro.texts ?? []), introCaption];
  const pages: Page[] = [intro];

  let photosRemaining = collapsed.length;
  let minLeft = photoMinTotal;

  for (const ch of chapters) {
    if (pages.length >= opts.limits.pagesMax) break;
    pages.push({
      template: 'one',
      cells: [],
      texts: [{ text: formatChapterTitle(ch.day), x: 0.5, y: 0.5, style: 'title' }],
    });

    if (photoBudget <= 0 || ch.photos.length === 0) continue;

    // Доля минимума пропорциональна оставшимся фото главы, но не больше бюджета.
    const shareMin = Math.min(
      photoBudget,
      Math.max(0, Math.ceil((ch.photos.length / Math.max(1, photosRemaining)) * minLeft)),
    );
    const laid = autoLayout(ch.photos, { pagesMin: shareMin, pagesMax: photoBudget });
    // Не тащим пустые доборы: только страницы с хотя бы одним фото.
    const withPhotos = laid.pages.filter((p) => p.cells.some((c) => c.photoId !== null));
    for (const page of withPhotos) {
      if (pages.length >= opts.limits.pagesMax || photoBudget <= 0) break;
      const caption = authorCaption(page, byId);
      pages.push(caption ? { ...page, texts: [...(page.texts ?? []), caption] } : page);
      photoBudget -= 1;
      minLeft = Math.max(0, minLeft - 1);
    }
    photosRemaining -= ch.photos.length;
  }

  const placed = new Set(
    pages.flatMap((p) => p.cells.map((c) => c.photoId).filter((id): id is string => id !== null)),
  );
  const omitted = collapsed.filter((p) => !placed.has(p.id)).length;

  return {
    layout: {
      pages,
      cover: { photoId: first?.id ?? null, title },
    },
    omitted,
  };
}
