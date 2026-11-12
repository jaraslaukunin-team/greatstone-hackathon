import { describe, expect, it } from 'vitest';
import { CELL_WIDTH_FRACTION, checkQuality } from './quality';
import type { Layout } from './types';
import type { PhotoMeta } from './layout';

const variant = { pageWidthCm: 20 };
const photo = (width: number): PhotoMeta => ({ id: 'a', width, height: width, takenAt: null });
const layoutWith = (photoId: string | null, scale = 1): Layout => ({
  pages: [{ template: 'one', cells: [{ photoId, crop: { x: 0, y: 0, scale, rotation: 0 } }] }],
});

describe('CELL_WIDTH_FRACTION', () => {
  it('has the agreed fractions', () => {
    expect(CELL_WIDTH_FRACTION).toEqual({ one: 1, two: 1, three: 0.5, four: 0.5, 'spread-one': 1 });
  });
});

describe('checkQuality', () => {
  it('2400 px gives dpi about 305 and no issues', () => {
    expect(checkQuality(layoutWith('a'), { a: photo(2400) }, variant)).toEqual([]);
  });

  it('1000 px gives low-dpi warning at about 127', () => {
    const [issue] = checkQuality(layoutWith('a'), { a: photo(1000) }, variant);
    expect(issue!).toMatchObject({ kind: 'low-dpi', severity: 'warning', pageIndex: 0, cellIndex: 0 });
    expect(issue!.dpi).toBeCloseTo(127, 0);
  });

  it('700 px gives very-low-dpi warning at about 89', () => {
    const [issue] = checkQuality(layoutWith('a'), { a: photo(700) }, variant);
    expect(issue!).toMatchObject({ kind: 'very-low-dpi', severity: 'warning' });
    expect(issue!.dpi).toBeCloseTo(89, 0);
  });

  it('empty cell is a blocker', () => {
    expect(checkQuality(layoutWith(null), {}, variant)).toEqual([
      { kind: 'empty-cell', severity: 'blocker', pageIndex: 0, cellIndex: 0 },
    ]);
  });

  it('crop scale 2 doubles required resolution: 2400 px gives about 152, no issues', () => {
    expect(checkQuality(layoutWith('a', 2), { a: photo(2400) }, variant)).toEqual([]);
    const [issue] = checkQuality(layoutWith('a', 2), { a: photo(2000) }, variant);
    expect(issue!.dpi).toBeCloseTo(127, 0);
  });

  it('four template halves the cell width', () => {
    const layout: Layout = {
      pages: [{ template: 'four', cells: [{ photoId: 'a', crop: { x: 0, y: 0, scale: 1, rotation: 0 } }] }],
    };
    expect(checkQuality(layout, { a: photo(1000) }, variant)).toEqual([]);
  });

  it('three template halves the cell width like four', () => {
    const layout: Layout = {
      pages: [{ template: 'three', cells: [{ photoId: 'a', crop: { x: 0, y: 0, scale: 1, rotation: 0 } }] }],
    };
    expect(checkQuality(layout, { a: photo(1000) }, variant)).toEqual([]);
  });

  it('flags a cell whose photo is absent from the map as a missing-photo blocker', () => {
    expect(checkQuality(layoutWith('ghost'), {}, variant)).toEqual([
      { kind: 'missing-photo', severity: 'blocker', pageIndex: 0, cellIndex: 0 },
    ]);
  });

  it('pins dpi boundaries at 150 and 100 (1-inch page)', () => {
    const inch = { pageWidthCm: 2.54 };
    expect(checkQuality(layoutWith('a'), { a: photo(150) }, inch)).toEqual([]);
    expect(checkQuality(layoutWith('a'), { a: photo(149) }, inch)[0]).toMatchObject({ kind: 'low-dpi' });
    expect(checkQuality(layoutWith('a'), { a: photo(100) }, inch)[0]).toMatchObject({ kind: 'low-dpi' });
    expect(checkQuality(layoutWith('a'), { a: photo(99) }, inch)[0]).toMatchObject({ kind: 'very-low-dpi' });
  });
});
