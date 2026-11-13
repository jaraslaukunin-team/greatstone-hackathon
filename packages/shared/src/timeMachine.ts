import { collapseSeries, type EventPhotoInput } from './event';
import { autoLayout } from './layout';
import type { Layout, Page } from './types';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const CHAPTER_COLORS = ['#F4E9DA', '#F5DEDF', '#DFEBE4'];
const STORY_CAPTIONS = [
  'Здесь всё начинается.',
  'Дни, к которым хочется вернуться.',
  'Моменты, которые хочется сохранить.',
];
const dateLabel = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

type Chapter = { label: string; caption: string; photos: EventPhotoInput[] };

function chapterPhotos(photos: EventPhotoInput[], chapterCount: number): Chapter[] {
  const periods: { start: number; end: number; photos: EventPhotoInput[] }[] = [];
  const undated: EventPhotoInput[] = [];
  for (const photo of photos) {
    const time = Date.parse(photo.takenAt ?? '');
    if (!Number.isFinite(time)) {
      undated.push(photo);
      continue;
    }
    const last = periods.at(-1);
    if (last && time - last.end <= WEEK_MS && time - last.start <= 4 * WEEK_MS) {
      last.end = time;
      last.photos.push(photo);
    } else {
      periods.push({ start: time, end: time, photos: [photo] });
    }
  }

  const datedCount = Math.max(1, chapterCount - Number(undated.length > 0));
  const chapters: Chapter[] = [];
  const groupSize = Math.ceil(periods.length / datedCount);
  for (let i = 0; i < periods.length; i += groupSize) {
    const group = periods.slice(i, i + groupSize);
    const first = dateLabel.format(group[0]!.start);
    const last = dateLabel.format(group.at(-1)!.end);
    chapters.push({
      label: first === last ? first : `${first} — ${last}`,
      caption: STORY_CAPTIONS[chapters.length % STORY_CAPTIONS.length]!,
      photos: group.flatMap((period) => period.photos),
    });
  }
  if (undated.length) chapters.push({ label: 'Без даты', caption: 'Воспоминания вне времени.', photos: undated });
  return chapters;
}

/** Черновик истории по датам съёмки. Текстовые слои можно менять в обычном редакторе. */
export function buildTimeMachineLayout(
  photos: EventPhotoInput[],
  { title, limits }: { title: string; limits: { pagesMin: number; pagesMax: number } },
): { layout: Layout; omitted: number } {
  const ordered = collapseSeries(photos);
  const chapterCount = Math.max(1, Math.min(8, Math.floor((limits.pagesMax - 1) / 2)));
  const chapters = chapterPhotos(ordered, chapterCount);
  const cover = { photoId: ordered[0]?.id ?? null, title: title.slice(0, 100) };
  const pages: Page[] = [{
    template: 'one',
    cells: [],
    texts: [{ text: cover.title, x: 0.5, y: 0.5, style: 'title' }],
  }];

  const shownChapters = chapters.slice(0, Math.floor(Math.max(0, limits.pagesMax - 1) / 2));
  let slots = limits.pagesMax - 1 - shownChapters.length;
  let remaining = ordered.length;
  for (const [index, chapter] of shownChapters.entries()) {
    pages.push({
      template: 'one',
      cells: [],
      bg: CHAPTER_COLORS[index % CHAPTER_COLORS.length],
      texts: [
        { text: chapter.label, x: 0.5, y: 0.4, style: 'title' },
        { text: chapter.caption, x: 0.5, y: 0.65, style: 'quote' },
      ],
    });
    const reserved = shownChapters.length - index - 1;
    const proportional = Math.ceil(slots * chapter.photos.length / remaining);
    const available = Math.min(slots - reserved, Math.max(1, proportional));
    const min = Math.min(available, Math.max(0, limits.pagesMin - pages.length));
    const { pages: photoPages } = autoLayout(chapter.photos, { pagesMin: min, pagesMax: available });
    const used = photoPages.filter((page) => page.cells.some((cell) => cell.photoId !== null));
    pages.push(...used);
    slots -= used.length;
    remaining -= chapter.photos.length;
  }

  while (pages.length < limits.pagesMin) {
    pages.push({ template: 'one', cells: [] });
  }
  const placed = new Set([cover.photoId, ...pages.flatMap((page) => page.cells.map((cell) => cell.photoId))]);
  return { layout: { pages, cover }, omitted: ordered.filter((photo) => !placed.has(photo.id)).length };
}
