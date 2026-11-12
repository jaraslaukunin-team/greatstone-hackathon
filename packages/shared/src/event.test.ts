import { describe, expect, it } from 'vitest';
import { buildEventLayout, type EventPhotoInput } from './event';
import { albumMemberSchema, projectSchema } from './schemas';

const base = (id: string, takenAt: string | null, extra: Partial<EventPhotoInput> = {}): EventPhotoInput => ({
  id,
  width: 3000,
  height: 4000,
  takenAt,
  uploadedBy: 'u1',
  authorName: 'Анна',
  ...extra,
});

const dayA = '2024-07-14T10:00:00.000Z';
const dayA2 = '2024-07-14T10:00:02.000Z';
const dayB = '2024-07-15T12:00:00.000Z';

function chapterTitles(pages: { cells: unknown[]; texts?: { text: string }[] }[]) {
  return pages.filter((p) => p.cells.length === 0).map((p) => p.texts?.[0]?.text ?? '');
}

describe('buildEventLayout', () => {
  it('две даты дают две главы с страницами-заголовками', () => {
    const { layout } = buildEventLayout(
      [base('a', dayA), base('b', dayB)],
      { title: 'Поездка', limits: { pagesMin: 4, pagesMax: 40 } },
    );
    expect(layout.pages[0]?.texts?.[0]?.text).toBe('Поездка');
    expect(layout.cover?.photoId).toBe('a');
    expect(chapterTitles(layout.pages)).toEqual([
      expect.stringMatching(/июл/i),
      expect.stringMatching(/июл/i),
    ]);
    expect(chapterTitles(layout.pages)[0]).not.toEqual(chapterTitles(layout.pages)[1]);
  });

  it('фото без даты — глава «Без даты» в конце', () => {
    const { layout } = buildEventLayout(
      [base('u', null), base('d', dayA)],
      { title: 'T', limits: { pagesMin: 2, pagesMax: 40 } },
    );
    const titles = chapterTitles(layout.pages);
    expect(titles.at(-1)).toBe('Без даты');
    expect(titles[0]).toMatch(/июл/i);
  });

  it('серия кадров одного автора схлопывается в большее фото', () => {
    const { layout } = buildEventLayout(
      [
        base('small', dayA, { width: 1000, height: 1000 }),
        base('big', dayA2, { width: 4000, height: 4000 }),
      ],
      { title: 'T', limits: { pagesMin: 1, pagesMax: 40 } },
    );
    const ids = layout.pages.flatMap((p) => p.cells.map((c) => c.photoId)).filter(Boolean);
    expect(ids).toContain('big');
    expect(ids).not.toContain('small');
  });

  it('серия разных авторов не схлопывается', () => {
    const { layout } = buildEventLayout(
      [
        base('a', dayA, { uploadedBy: 'u1', authorName: 'Анна' }),
        base('b', dayA2, { uploadedBy: 'u2', authorName: 'Борис' }),
      ],
      { title: 'T', limits: { pagesMin: 1, pagesMax: 40 } },
    );
    const ids = layout.pages.flatMap((p) => p.cells.map((c) => c.photoId)).filter(Boolean);
    expect(ids).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('подпись автора только на странице с одним известным автором', () => {
    const { layout } = buildEventLayout(
      [base('solo', dayA, { authorName: 'Анна', uploadedBy: 'u1' })],
      { title: 'T', limits: { pagesMin: 1, pagesMax: 40 } },
    );
    const photoPage = layout.pages.find((p) => p.cells.some((c) => c.photoId === 'solo'));
    expect(photoPage?.texts?.some((t) => t.text === 'Фото: Анна' && t.style === 'caption')).toBe(true);

    const mixed = buildEventLayout(
      [
        base('a', dayA, { uploadedBy: 'u1', authorName: 'Анна' }),
        base('b', dayA, { uploadedBy: 'u2', authorName: 'Борис', width: 4000, height: 3000 }),
      ],
      { title: 'T', limits: { pagesMin: 1, pagesMax: 40 } },
    ).layout;
    const captions = mixed.pages.flatMap((p) => p.texts ?? []).filter((t) => t.text.startsWith('Фото:'));
    // На страницах с разными авторами подписи нет; на single-author страницах — есть.
    for (const page of mixed.pages) {
      const authors = new Set(
        page.cells.map((c) => c.photoId).filter(Boolean).map((id) => (id === 'a' ? 'Анна' : id === 'b' ? 'Борис' : null)),
      );
      if (authors.size > 1) {
        expect(page.texts?.some((t) => t.text.startsWith('Фото:'))).toBeFalsy();
      }
    }
    expect(captions.every((c) => c.y === 0.95)).toBe(true);
  });

  it('лимит страниц: omitted считает не поместившиеся фото', () => {
    const photos = Array.from({ length: 20 }, (_, i) =>
      base(`p${i}`, `2024-07-14T${String(10 + i).padStart(2, '0')}:00:00.000Z`),
    );
    const { layout, omitted } = buildEventLayout(photos, { title: 'T', limits: { pagesMin: 2, pagesMax: 6 } });
    expect(layout.pages.length).toBeLessThanOrEqual(6);
    expect(omitted).toBeGreaterThan(0);
  });

  it('пустой список даёт вводную и обложку без падения', () => {
    const { layout, omitted } = buildEventLayout([], { title: 'Пусто', limits: { pagesMin: 1, pagesMax: 40 } });
    expect(layout.pages.length).toBeGreaterThanOrEqual(1);
    expect(layout.cover?.title).toBe('Пусто');
    expect(layout.cover?.photoId).toBeNull();
    expect(omitted).toBe(0);
  });
});

describe('schemas event fields', () => {
  it('projectSchema принимает isPool и sourceProjectId', () => {
    const baseProject = {
      id: 'p',
      title: 't',
      variantId: 'v',
      ownerId: 'o',
      status: 'draft',
      isShared: true,
      expectedMembers: null,
      hasPassword: false,
      layout: { pages: [] },
      version: 1,
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    expect(projectSchema.safeParse({ ...baseProject, isPool: true, sourceProjectId: null }).success).toBe(true);
    expect(projectSchema.safeParse({ ...baseProject, sourceProjectId: 'src' }).success).toBe(true);
  });

  it('albumMemberSchema принимает displayName', () => {
    const m = { userId: 'u', childName: null, role: 'contributor', photosCount: 0, wish: null, videoUrl: null };
    expect(albumMemberSchema.safeParse({ ...m, displayName: 'Иван' }).success).toBe(true);
    expect(albumMemberSchema.safeParse({ ...m, displayName: null }).success).toBe(true);
  });
});
