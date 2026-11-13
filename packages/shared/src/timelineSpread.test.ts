import { expect, it } from 'vitest';
import { layoutSchema } from './schemas';
import { buildTimelineSpread, timelineCurves } from './timelineSpread';

it('builds a printable spread with chronological stops and multiple photos per date', () => {
  const photos = ['2025-06-10', '2015-09-01', '2020-02-16'].flatMap((day) =>
    [1, 2, 3, 4].map((index) => ({ id: `${day}-${index}`, takenAt: `${day}T12:00:00Z` })),
  );
  const pages = buildTimelineSpread(photos, 'en');
  expect(layoutSchema.parse({ pages }).pages).toEqual(pages);
  expect(pages.map((page) => page.cells.length)).toEqual([6, 3]);
  expect(pages[0].cells[0]?.photoId).toBe('2015-09-01-1');
  expect(pages[0].texts?.map((label) => label.text)).toEqual(['Sep 1, 2015', 'Feb 16, 2020']);
  expect(timelineCurves.left.end[1]).toBe(timelineCurves.right.start[1]);
});
