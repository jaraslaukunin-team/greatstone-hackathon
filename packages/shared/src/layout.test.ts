import { describe, expect, it } from 'vitest';
import { autoLayout, unplacedPhotos, type PhotoMeta } from './layout';

const portrait = (id: string, takenAt: string | null): PhotoMeta => ({ id, width: 3000, height: 4000, takenAt });
const landscape = (id: string, takenAt: string | null): PhotoMeta => ({ id, width: 4000, height: 3000, takenAt });
const ids = (l: ReturnType<typeof autoLayout>) =>
  l.pages.flatMap((p) => p.cells.map((c) => c.photoId)).filter((x) => x !== null);

describe('autoLayout', () => {
  it('orders pages by takenAt ascending', () => {
    const photos = Array.from({ length: 10 }, (_, i) =>
      portrait(`p${i}`, `2026-01-${String(10 - i).padStart(2, '0')}T10:00:00Z`),
    );
    const layout = autoLayout(photos, { pagesMin: 10, pagesMax: 60 });
    expect(ids(layout)).toEqual([...photos].reverse().map((p) => p.id));
  });

  it('puts photos without date last in original order', () => {
    const photos = [portrait('n1', null), portrait('d', '2026-01-01T00:00:00Z'), portrait('n2', null)];
    expect(ids(autoLayout(photos, { pagesMin: 1, pagesMax: 10 }))).toEqual(['d', 'n1', 'n2']);
  });

  it('не склеивает пары, пока фото едва хватает на минимум страниц', () => {
    const photos = Array.from({ length: 24 }, (_, i) =>
      landscape(`l${i}`, `2026-01-01T10:${String(i).padStart(2, '0')}:00Z`),
    );
    const layout = autoLayout(photos, { pagesMin: 20, pagesMax: 60 });
    expect(layout.pages.length).toBe(20);
    expect(layout.pages.every((p) => p.cells.every((c) => c.photoId !== null))).toBe(true);
    expect(ids(layout).length).toBe(24);
  });

  it('pads to pagesMin with empty cells', () => {
    const photos = [portrait('a', null), portrait('b', null), portrait('c', null)];
    const layout = autoLayout(photos, { pagesMin: 10, pagesMax: 60 });
    expect(layout.pages.length).toBe(10);
    expect(layout.pages.slice(3).every((p) => p.cells.every((c) => c.photoId === null))).toBe(true);
  });

  it('returns exactly pagesMax pages and reports unplaced photos on overflow', () => {
    const photos = Array.from({ length: 100 }, (_, i) => portrait(`p${i}`, null));
    const layout = autoLayout(photos, { pagesMin: 10, pagesMax: 20 });
    expect(layout.pages.length).toBe(20);
    const unplaced = unplacedPhotos(layout, photos);
    const placed = ids(layout);
    expect(placed.length).toBe(80);
    expect(unplaced.length).toBe(20);
    expect(new Set(placed).size).toBe(placed.length);
    expect(unplaced.map((x) => x.id)).toEqual(photos.slice(80).map((x) => x.id));
  });

  it('treats an invalid takenAt as undated (last, stable)', () => {
    const photos = [portrait('bad', 'garbage'), portrait('d2', '2026-02-01T00:00:00Z'), portrait('n', null), portrait('d1', '2026-01-01T00:00:00Z')];
    expect(ids(autoLayout(photos, { pagesMin: 1, pagesMax: 10 }))).toEqual(['d1', 'd2', 'bad', 'n']);
  });

  it('uses template one for a portrait 3000x4000', () => {
    const layout = autoLayout([portrait('a', null)], { pagesMin: 1, pagesMax: 5 });
    expect(layout.pages[0]!.template).toBe('one');
  });

  it('uses template two for two consecutive landscapes', () => {
    const layout = autoLayout([landscape('a', null), landscape('b', null)], { pagesMin: 1, pagesMax: 5 });
    expect(layout.pages[0]!.template).toBe('two');
    expect(layout.pages[0]!.cells.map((c) => c.photoId)).toEqual(['a', 'b']);
  });

  it('is deterministic and does not mutate input', () => {
    const photos = [portrait('b', '2026-02-01T00:00:00Z'), portrait('a', '2026-01-01T00:00:00Z')];
    const copy = JSON.parse(JSON.stringify(photos));
    const v = { pagesMin: 2, pagesMax: 5 };
    expect(autoLayout(photos, v)).toEqual(autoLayout(photos, v));
    expect(photos).toEqual(copy);
  });
});
