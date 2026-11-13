import { describe, expect, it } from 'vitest';
import type { EventPhotoInput } from './event';
import { checkQuality } from './quality';
import { layoutSchema } from './schemas';
import { buildTimeMachineLayout } from './timeMachine';

const limits = { pagesMin: 20, pagesMax: 40 };

function photo(id: string, takenAt: string | null): EventPhotoInput {
  return { id, takenAt, width: 3000, height: 2000, uploadedBy: 'demo', authorName: null };
}

function build(photos: EventPhotoInput[], pageLimits = limits) {
  return buildTimeMachineLayout(photos, { title: 'Наша история', limits: pageLimits });
}

describe('PicPac Time Machine', () => {
  it('собирает близкие даты в главу и располагает главы по годам', () => {
    const photos = [
      photo('end', '2025-06-10T09:00:00Z'),
      photo('week', '2015-09-03T09:00:00Z'),
      photo('first', '2015-09-01T09:00:00Z'),
      photo('undated', null),
    ];
    const { layout, omitted } = build(photos);
    const chapters = layout.pages.filter((page) => page.texts?.some((text) => text.style === 'quote'));
    expect(chapters.map((page) => page.texts?.[0]?.text)).toEqual([
      expect.stringMatching(/1 сентября 2015.*3 сентября 2015/),
      expect.stringMatching(/10 июня 2025/),
      'Без даты',
    ]);
    expect(layout.cover?.photoId).toBe('first');
    expect(layout.pages.flatMap((page) => page.cells.map((cell) => cell.photoId))).toEqual(['first', 'week', 'end', 'undated']);
    expect(omitted).toBe(0);
  });

  it('собирает 30 синтетических кадров в валидную книгу без блокеров перед печатью', () => {
    const months = ['2015-09', '2020-02', '2025-06'];
    const photos = months.flatMap((month) =>
      Array.from({ length: 10 }, (_, index) => photo(`${month}-${index}`, `${month}-01T12:${String(index).padStart(2, '0')}:00Z`)),
    );
    const { layout, omitted } = build(photos);
    expect(layoutSchema.safeParse(layout).success).toBe(true);
    expect(layout.pages.length).toBeGreaterThanOrEqual(limits.pagesMin);
    expect(layout.pages.length).toBeLessThanOrEqual(limits.pagesMax);
    expect(new Set(layout.pages.flatMap((page) => page.cells.map((cell) => cell.photoId))).size).toBe(30);
    expect(checkQuality(layout, Object.fromEntries(photos.map((item) => [item.id, item])), { pageWidthCm: 20 })).toEqual([]);
    expect(omitted).toBe(0);
  });

  it('ограничивает число глав и сообщает о непоместившихся фото', () => {
    const photos = Array.from({ length: 100 }, (_, index) =>
      photo(String(index), `${1900 + index}-09-01T12:00:00Z`),
    );
    const { layout, omitted } = build(photos, { pagesMin: 6, pagesMax: 6 });
    const photoIds = new Set(layout.pages.flatMap((page) => page.cells.map((cell) => cell.photoId)));
    expect(layout.pages).toHaveLength(6);
    expect(layout.pages.filter((page) => page.texts?.some((text) => text.style === 'quote'))).toHaveLength(2);
    expect(omitted).toBe(photos.length - photoIds.size);
  });

  it('добирает минимальное число страниц без пустых ячеек', () => {
    const { layout } = build([photo('one', null)]);
    expect(layout.pages).toHaveLength(20);
    expect(layout.pages.every((page) => page.cells.every((cell) => cell.photoId !== null))).toBe(true);
  });
});
