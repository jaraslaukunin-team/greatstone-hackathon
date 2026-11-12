// jest-expo preset automatically mocks binary assets (JPEG → integer handle),
// so no manual moduleNameMapper is needed for the require() calls in examples.ts.

import { EXAMPLES, exampleById, showcaseSourceOf } from './examples';

describe('EXAMPLES', () => {
  it('has exactly 4 entries', () => {
    expect(EXAMPLES).toHaveLength(4);
  });

  it('ids are film, travel, holiday, graduation', () => {
    const ids = EXAMPLES.map((e) => e.id);
    expect(ids).toEqual(['film', 'travel', 'holiday', 'graduation']);
  });

  it('each example has a non-empty title and description', () => {
    for (const ex of EXAMPLES) {
      expect(ex.title.trim().length).toBeGreaterThan(0);
      expect(ex.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('each example has 3 photos with positive dimensions', () => {
    for (const ex of EXAMPLES) {
      expect(ex.photos).toHaveLength(3);
      for (const p of ex.photos) {
        expect(p.width).toBeGreaterThan(0);
        expect(p.height).toBeGreaterThan(0);
      }
    }
  });

  it('each layout has 6–12 pages', () => {
    for (const ex of EXAMPLES) {
      expect(ex.layout.pages.length).toBeGreaterThanOrEqual(6);
      expect(ex.layout.pages.length).toBeLessThanOrEqual(12);
    }
  });

  it('layout themeId matches example themeId', () => {
    for (const ex of EXAMPLES) {
      expect(ex.layout.themeId).toBe(ex.themeId);
    }
  });

  it('all layout cell photoIds reference photos in the example', () => {
    for (const ex of EXAMPLES) {
      const known = new Set(ex.photos.map((p) => p.id));
      for (const page of ex.layout.pages) {
        for (const cell of page.cells) {
          if (cell.photoId !== null) {
            expect(known.has(cell.photoId)).toBe(true);
          }
        }
      }
    }
  });
});

describe('exampleById', () => {
  it('returns example for each known id', () => {
    for (const ex of EXAMPLES) {
      expect(exampleById(ex.id)?.id).toBe(ex.id);
    }
  });

  it('returns undefined for unknown id', () => {
    expect(exampleById('nonexistent')).toBeUndefined();
  });
});

describe('showcaseSourceOf', () => {
  it('returns a path starting with /catalog/books', () => {
    for (const ex of EXAMPLES) {
      expect(showcaseSourceOf(ex)).toMatch(/^\/catalog\/books/);
    }
  });

  it('includes the theme id in the query string', () => {
    for (const ex of EXAMPLES) {
      expect(showcaseSourceOf(ex)).toContain(`theme=${ex.themeId}`);
    }
  });
});
