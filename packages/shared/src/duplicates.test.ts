import { describe, expect, it } from 'vitest';
import { findDuplicatePhotoGroups } from './duplicates.js';

describe('findDuplicatePhotoGroups', () => {
  it('returns empty when no duplicates', () => {
    expect(
      findDuplicatePhotoGroups([
        { id: 'a', contentHash: 'h1' },
        { id: 'b', contentHash: 'h2' },
        { id: 'c', contentHash: null },
      ]),
    ).toEqual([]);
  });

  it('groups identical hashes and ignores null/blank', () => {
    expect(
      findDuplicatePhotoGroups([
        { id: 'a', contentHash: 'same' },
        { id: 'b', contentHash: null },
        { id: 'c', contentHash: 'same' },
        { id: 'd', contentHash: '  ' },
        { id: 'e', contentHash: 'other' },
        { id: 'f', contentHash: 'same' },
      ]),
    ).toEqual([['a', 'c', 'f']]);
  });

  it('returns multiple groups', () => {
    expect(
      findDuplicatePhotoGroups([
        { id: '1', contentHash: 'x' },
        { id: '2', contentHash: 'y' },
        { id: '3', contentHash: 'x' },
        { id: '4', contentHash: 'y' },
      ]),
    ).toEqual([
      ['1', '3'],
      ['2', '4'],
    ]);
  });
});
