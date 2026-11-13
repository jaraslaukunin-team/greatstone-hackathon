import type { Layout, PhotoDTO } from '@picpac/shared';
import { storyTimeline } from './storyTimeline';

it('orders dated photos, leaves missing dates last and jumps to the original spread', () => {
  const photo = (id: string, takenAt: string | null) => ({ id, takenAt }) as PhotoDTO;
  const photos = new Map([
    ['late', photo('late', '2025-02-03T00:00:00Z')],
    ['early', photo('early', '2015-09-01T00:00:00Z')],
    ['unknown', photo('unknown', null)],
  ]);
  const page = (photoId: string) => ({
    template: 'one' as const,
    cells: [{ photoId, crop: { x: 0, y: 0, scale: 1, rotation: 0 as const } }],
  });
  const layout: Layout = { pages: [page('late'), page('unknown'), page('late'), page('early')] };
  expect(storyTimeline(layout, photos).map(({ photo, day, spread }) => [photo.id, day, spread])).toEqual([
    ['early', '2015-09-01', 2],
    ['late', '2025-02-03', 0],
    ['unknown', null, 1],
  ]);
});
