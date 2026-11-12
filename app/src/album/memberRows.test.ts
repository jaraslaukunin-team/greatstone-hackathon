import { memberRows } from './memberRows';
import type { AlbumProgress } from './useAlbumProgress';

test('returns empty array for null progress', () => {
  expect(memberRows(null)).toEqual([]);
});

test('returns empty array for progress with no members', () => {
  const progress: AlbumProgress = { expected: 5, members: [] };
  expect(memberRows(progress)).toEqual([]);
});

test('first member is labeled Организатор', () => {
  const progress: AlbumProgress = {
    expected: 3,
    members: [
      { userId: 'u1', childName: 'Иван', photosCount: 5 },
    ],
  };
  const rows = memberRows(progress);
  expect(rows[0].name).toBe('Организатор');
});

test('organizer done flag reflects photosCount', () => {
  const progress: AlbumProgress = {
    expected: 3,
    members: [
      { userId: 'u1', childName: null, photosCount: 0 },
    ],
  };
  expect(memberRows(progress)[0].done).toBe(false);
});

test('non-organizer uses childName when set', () => {
  const progress: AlbumProgress = {
    expected: 3,
    members: [
      { userId: 'u1', childName: null, photosCount: 2 },
      { userId: 'u2', childName: 'Маша', photosCount: 3 },
    ],
  };
  const rows = memberRows(progress);
  expect(rows[1].name).toBe('Маша');
});

test('non-organizer without childName gets Участник N', () => {
  const progress: AlbumProgress = {
    expected: 3,
    members: [
      { userId: 'u1', childName: null, photosCount: 0 },
      { userId: 'u2', childName: null, photosCount: 0 },
      { userId: 'u3', childName: null, photosCount: 0 },
    ],
  };
  const rows = memberRows(progress);
  expect(rows[1].name).toBe('Участник 1');
  expect(rows[2].name).toBe('Участник 2');
});

test('done is true when photosCount > 0', () => {
  const progress: AlbumProgress = {
    expected: 2,
    members: [
      { userId: 'u1', childName: null, photosCount: 1 },
      { userId: 'u2', childName: null, photosCount: 0 },
    ],
  };
  const rows = memberRows(progress);
  expect(rows[0].done).toBe(true);
  expect(rows[1].done).toBe(false);
});

test('photos field matches photosCount', () => {
  const progress: AlbumProgress = {
    expected: 1,
    members: [{ userId: 'u1', childName: null, photosCount: 7 }],
  };
  expect(memberRows(progress)[0].photos).toBe(7);
});
