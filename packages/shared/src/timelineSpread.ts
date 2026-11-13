import type { Cell, Page } from './types';

type TimelinePhoto = { id: string; takenAt: string | null };
export type TimelineSide = 'left' | 'right';
export const timelineCurves = {
  left: { start: [0, 0.56], first: [0.33, 0.83], second: [0.67, 0.22], end: [1, 0.5] },
  right: { start: [0, 0.5], first: [0.33, 0.78], second: [0.67, 0.17], end: [1, 0.44] },
} as const;

export function timelineAnchors(side: TimelineSide) {
  const { start, first, second, end } = timelineCurves[side];
  return [0.25, 0.75].map((t) => {
    const u = 1 - t;
    return [0, 1].map((axis) => u ** 3 * start[axis]! + 3 * u ** 2 * t * first[axis]! +
      3 * u * t ** 2 * second[axis]! + t ** 3 * end[axis]!);
  });
}

export function buildTimelineSpread(photos: TimelinePhoto[], locale: string): [Page, Page] {
  const groups = new Map<string, string[]>();
  for (const photo of photos) {
    const timestamp = Date.parse(photo.takenAt ?? '');
    if (!Number.isFinite(timestamp)) continue;
    const day = new Date(timestamp).toISOString().slice(0, 10);
    const group = groups.get(day) ?? [];
    group.push(photo.id);
    groups.set(day, group);
  }
  const days = [...groups.keys()].sort();
  const picked = days.length <= 4 ? days : [0, 1, 2, 3].map((index) => days[Math.round(index * (days.length - 1) / 3)]!);
  const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  function page(side: TimelineSide, selected: string[]): Page {
    const anchors = timelineAnchors(side);
    const cells: Cell[] = [];
    const texts: NonNullable<Page['texts']> = [];
    selected.forEach((day, index) => {
      const x = anchors[index]![0]!;
      const y = index === 0 ? 0.25 : 0.76;
      const ids = groups.get(day)!.slice(0, 3);
      ids.forEach((photoId, frameIndex) => {
        cells.push({
          photoId, fit: 'cover', border: true,
          crop: { x: 0, y: 0, scale: 1, rotation: 0 },
          frame: { x: x + (frameIndex - (ids.length - 1) / 2) * 0.13, y, w: 0.14, h: 0.19, rot: (frameIndex - 1) * 7 },
        });
      });
      texts.push({ text: format.format(new Date(day)), x, y: index === 0 ? 0.40 : 0.91, style: 'date' });
    });
    return { template: 'one', cells, texts, timeline: side };
  }
  const split = Math.ceil(picked.length / 2);
  return [page('left', picked.slice(0, split)), page('right', picked.slice(split))];
}
