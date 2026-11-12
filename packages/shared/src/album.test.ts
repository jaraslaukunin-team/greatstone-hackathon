import { describe, expect, it } from 'vitest';
import { buildAlbumLayout, personalizeLayout, type AlbumPhotoInput } from './album';
import type { Layout } from './types';

const photo = (id: string, uploadedBy: string | null, day = 1): AlbumPhotoInput => ({
  id,
  width: 4000,
  height: 3000,
  takenAt: `2027-06-0${day}T10:00:00.000Z`,
  uploadedBy,
});
const member = (userId: string, childName: string | null, extra: object = {}) => ({
  userId,
  childName,
  wish: null as string | null,
  videoUrl: null as string | null,
  ...extra,
});
const limits = { pagesMin: 20, pagesMax: 40 };
const ids = (p: { cells: { photoId: string | null }[] }) => p.cells.map((c) => c.photoId);
const personal = (layout: Layout, userId: string) => layout.pages.filter((p) => p.memberId === userId);

describe('buildAlbumLayout', () => {
  const photos = [photo('a1', 'ann'), photo('a2', 'ann'), photo('a3', 'ann'), photo('a4', 'ann'), photo('b1', 'bob'), photo('b2', 'bob'), photo('c1', 'cat')];
  const members = [member('cat', 'Вера'), member('ann', 'Анна', { wish: 'Удачи всем!', videoUrl: 'https://youtu.be/abc' }), member('bob', 'Борис')];

  it('обложка, вводная страница и личная пара на каждого участника по алфавиту', () => {
    const { layout, skipped } = buildAlbumLayout({ title: '11 Б', members, photos }, limits);
    expect(skipped).toEqual([]);
    expect(layout.cover).toMatchObject({ title: '11 Б', subtitle: 'Выпускной альбом' });
    const owners = layout.pages.filter((p) => p.memberId).map((p) => p.memberId);
    expect(owners).toEqual(['ann', 'ann', 'bob', 'bob', 'cat', 'cat']);
  });

  it('шаблон личной страницы по числу фото: 3+ → three, 2 → two, 1 → one; не больше трёх', () => {
    const { layout } = buildAlbumLayout({ title: 'T', members, photos }, limits);
    const [annLeft] = personal(layout, 'ann');
    const [bobLeft] = personal(layout, 'bob');
    const [catLeft] = personal(layout, 'cat');
    expect(annLeft!.template).toBe('three');
    expect(ids(annLeft!)).toEqual(['a1', 'a2', 'a3']);
    expect(bobLeft!.template).toBe('two');
    expect(catLeft!.template).toBe('one');
  });

  it('участник без фото получает пустую ячейку и не ломает сборку', () => {
    const { layout } = buildAlbumLayout({ title: 'T', members: [member('x', 'Ян')], photos: [] }, limits);
    const [left] = personal(layout, 'x');
    expect(left!.template).toBe('one');
    expect(ids(left!)).toEqual([null]);
  });

  it('справа имя, пожелание и QR; без видео QR нет, небезопасная ссылка игнорируется', () => {
    const { layout } = buildAlbumLayout({ title: 'T', members, photos }, limits);
    const annRight = personal(layout, 'ann')[1]!;
    expect(annRight.cells).toEqual([]);
    expect(annRight.texts?.map((t) => t.text)).toEqual(['Анна', 'Удачи всем!']);
    expect(annRight.qr).toMatchObject({ url: 'https://youtu.be/abc', size: 0.26 });
    expect(personal(layout, 'bob')[1]!.qr).toBeUndefined();
    const evil = buildAlbumLayout({ title: 'T', members: [member('e', 'Эл', { videoUrl: 'javascript:alert(1)' })], photos }, limits);
    expect(personal(evil.layout, 'e')[1]!.qr).toBeUndefined();
  });

  it('число страниц нечётное (вводная + пары), в пределах варианта', () => {
    const { layout } = buildAlbumLayout({ title: 'T', members, photos }, limits);
    expect(layout.pages.length % 2).toBe(1);
    expect(layout.pages.length).toBeGreaterThanOrEqual(limits.pagesMin);
    expect(layout.pages.length).toBeLessThanOrEqual(limits.pagesMax);
  });

  it('не поместившиеся участники попадают в skipped, а общие развороты сокращаются первыми', () => {
    const many = Array.from({ length: 6 }, (_, i) => member(`u${i}`, `Имя ${i}`));
    const { layout, skipped } = buildAlbumLayout({ title: 'T', members: many, photos }, { pagesMin: 4, pagesMax: 9 });
    // 1 вводная + 2 × 4 участника = 9 страниц; общих разворотов не остаётся, двое не вошли.
    expect(layout.pages).toHaveLength(9);
    expect(skipped).toEqual(['u4', 'u5']);
    expect(layout.pages.filter((p) => p.memberId).length).toBe(8);
  });
});

describe('personalizeLayout', () => {
  const base = buildAlbumLayout(
    { title: 'T', members: [member('ann', 'Анна'), member('bob', 'Борис'), member('cat', 'Вера')], photos: [photo('a1', 'ann'), photo('b1', 'bob'), photo('c1', 'cat')] },
    { pagesMin: 4, pagesMax: 40 },
  ).layout;

  it('переносит пару участника на индексы 1–2 и ставит имя в подзаголовок', () => {
    const r = personalizeLayout(base, 'cat', 'Вера');
    expect(r.pages[1]!.memberId).toBe('cat');
    expect(r.pages[2]!.memberId).toBe('cat');
    expect(r.cover?.subtitle).toBe('Вера');
    expect(r.pages).toHaveLength(base.pages.length);
    // Чужие пары остаются парами (соседние страницы с одним владельцем).
    const owners = r.pages.filter((p) => p.memberId).map((p) => p.memberId);
    expect(owners.filter((o) => o === 'ann')).toHaveLength(2);
    expect(owners.filter((o) => o === 'bob')).toHaveLength(2);
  });

  it('множество фото не меняется, исходный макет не мутируется', () => {
    const photosOf = (l: Layout) => l.pages.flatMap((p) => p.cells.map((c) => c.photoId)).sort().join();
    const before = JSON.stringify(base);
    const r = personalizeLayout(base, 'bob', 'Борис');
    expect(photosOf(r)).toBe(photosOf(base));
    expect(JSON.stringify(base)).toBe(before);
  });

  it('без личных страниц меняется только обложка; без имени ничего не меняется', () => {
    const r = personalizeLayout(base, 'nobody', 'Кто-то');
    expect(r.pages).toEqual(base.pages);
    expect(r.cover?.subtitle).toBe('Кто-то');
    expect(personalizeLayout(base, 'nobody', null)).toEqual(base);
  });

  it('пара уже на позициях 1–2 остаётся на месте', () => {
    const first = personalizeLayout(base, 'ann', 'Анна');
    expect(first.pages[1]!.memberId).toBe('ann');
    expect(personalizeLayout(first, 'ann', 'Анна').pages).toEqual(first.pages);
  });
});

describe('правки по ревью', () => {
  it('длинное название проекта обрезается до 100 символов в обложке', () => {
    const { layout } = buildAlbumLayout({ title: 'Я'.repeat(150), members: [], photos: [] }, { pagesMin: 4, pagesMax: 40 });
    expect(layout.cover?.title).toHaveLength(100);
  });

  it('именная копия: если у участника не пара соседних страниц, порядок страниц не ломается', () => {
    const cell = { photoId: null, crop: { x: 0, y: 0, scale: 1, rotation: 0 as const } };
    const page = (memberId?: string) => ({ template: 'one' as const, cells: [cell], ...(memberId ? { memberId } : {}) });
    const single: Layout = { pages: [page(), page(), page(), page(), page('x'), page(), page()] };
    const r = personalizeLayout(single, 'x', 'Икс');
    expect(r.pages.map((p) => p.memberId ?? '-')).toEqual(single.pages.map((p) => p.memberId ?? '-'));
    expect(r.cover?.subtitle).toBe('Икс');
  });
});
