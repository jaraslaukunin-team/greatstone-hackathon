import { describe, it, expect } from 'vitest';
import { albumMemberSchema, createOrderRequestSchema, layoutSchema, updateMyMemberRequestSchema } from './schemas';
import { formatByn } from './money';

const uuid = '3f2b8c1e-9d4a-4e6b-8a1f-2c7d5e9b0a11';

describe('createOrderRequestSchema', () => {
  it('принимает корректный запрос', () => {
    const r = createOrderRequestSchema.safeParse({ projectId: uuid, delivery: 'ems', expectedTotalKop: 8790 });
    expect(r.success).toBe(true);
  });
  it('отклоняет неизвестный способ доставки', () => {
    const r = createOrderRequestSchema.safeParse({ projectId: uuid, delivery: 'dhl', expectedTotalKop: 8790 });
    expect(r.success).toBe(false);
  });
  it('отклоняет дробную сумму', () => {
    const r = createOrderRequestSchema.safeParse({ projectId: uuid, delivery: 'ems', expectedTotalKop: 8790.5 });
    expect(r.success).toBe(false);
  });
});

describe('layoutSchema', () => {
  it('отклоняет scale: 0', () => {
    const r = layoutSchema.safeParse({
      pages: [{ template: 'one', cells: [{ photoId: null, crop: { x: 0, y: 0, scale: 0, rotation: 0 } }] }],
    });
    expect(r.success).toBe(false);
  });
  it('принимает корректный макет', () => {
    const r = layoutSchema.safeParse({
      pages: [{ template: 'one', cells: [{ photoId: null, crop: { x: 0, y: 0, scale: 1, rotation: 90 } }] }],
    });
    expect(r.success).toBe(true);
  });
  const cell = { photoId: null, crop: { x: 0, y: 0, scale: 1, rotation: 0 } };
  it('принимает шаблон three, фон и тексты страницы', () => {
    const r = layoutSchema.safeParse({
      pages: [
        {
          template: 'three',
          bg: '#EDD5D5',
          cells: [cell, cell, cell],
          texts: [{ text: 'Лето 2026', x: 0.5, y: 0.9, style: 'caption' }],
        },
      ],
    });
    expect(r.success).toBe(true);
  });
  it('отклоняет неизвестный стиль текста и точку за пределами страницы', () => {
    const page = (text: object) => ({ pages: [{ template: 'one', cells: [cell], texts: [text] }] });
    expect(layoutSchema.safeParse(page({ text: 'a', x: 0.5, y: 0.5, style: 'bold' })).success).toBe(false);
    expect(layoutSchema.safeParse(page({ text: 'a', x: 1.5, y: 0.5, style: 'title' })).success).toBe(false);
    expect(layoutSchema.safeParse(page({ text: 'a', x: 0.5, y: -0.1, style: 'title' })).success).toBe(false);
  });
  it('отклоняет слишком длинный текст', () => {
    const long = 'я'.repeat(201);
    expect(layoutSchema.safeParse({ pages: [{ template: 'one', cells: [cell], texts: [{ text: long, x: 0.5, y: 0.5, style: 'title' }] }] }).success).toBe(false);
  });
  it('принимает обложку с фото, названием, подзаголовком и корешком; без неё макет валиден', () => {
    const pages = [{ template: 'one', cells: [cell] }];
    const withCover = layoutSchema.parse({ pages, cover: { photoId: 'p1', title: 'Лето', subtitle: '2026', spine: 'Лето' } });
    expect(withCover.cover).toEqual({ photoId: 'p1', title: 'Лето', subtitle: '2026', spine: 'Лето' });
    expect(layoutSchema.parse({ pages, cover: { photoId: null, title: '' } }).cover?.photoId).toBeNull();
    expect(layoutSchema.parse({ pages }).cover).toBeUndefined();
  });
  it('seen — список уже учтённых фото: принимается, а без него макет валиден', () => {
    const pages = [{ template: 'one', cells: [cell] }];
    expect(layoutSchema.parse({ pages, seen: ['a', 'b'] }).seen).toEqual(['a', 'b']);
    expect(layoutSchema.parse({ pages }).seen).toBeUndefined();
    expect(layoutSchema.safeParse({ pages, seen: [1] }).success).toBe(false);
  });
  it('принимает цвет обложки и отступы страницы; без них макет валиден', () => {
    const r = layoutSchema.parse({
      pages: [{ template: 'one', cells: [cell], gap: 0.05 }],
      cover: { photoId: null, title: '', color: '#EDD5D5' },
    });
    expect(r.cover?.color).toBe('#EDD5D5');
    expect(r.pages[0]?.gap).toBe(0.05);
    const plain = layoutSchema.parse({ pages: [{ template: 'one', cells: [cell] }] });
    expect(plain.pages[0]?.gap).toBeUndefined();
  });
  it('отклоняет gap вне 0..0.12 и слишком длинный цвет обложки', () => {
    const page = (gap: number) => ({ pages: [{ template: 'one', cells: [cell], gap }] });
    expect(layoutSchema.safeParse(page(0.5)).success).toBe(false);
    expect(layoutSchema.safeParse(page(-0.1)).success).toBe(false);
    const pages = [{ template: 'one', cells: [cell] }];
    expect(layoutSchema.safeParse({ pages, cover: { photoId: null, title: '', color: 'x'.repeat(21) } }).success).toBe(false);
  });
  it('принимает свободный слой: frame, hidden, locked, border и поворот подписи', () => {
    const framed = { ...cell, frame: { x: 0.5, y: 0.4, w: 0.4, h: 0.3, rot: -8 }, hidden: true, locked: true, border: true };
    const r = layoutSchema.parse({
      pages: [{ template: 'one', cells: [framed], texts: [{ text: 'a', x: 0.5, y: 0.5, style: 'title', rot: 5, hidden: true, locked: false }] }],
    });
    expect(r.pages[0]?.cells[0]).toMatchObject({ frame: { rot: -8 }, hidden: true, locked: true, border: true });
    expect(r.pages[0]?.texts?.[0]).toMatchObject({ rot: 5, hidden: true });
  });
  it('отклоняет frame вне границ и больше 60 ячеек', () => {
    const f = (frame: object) => ({ pages: [{ template: 'one', cells: [{ ...cell, frame }] }] });
    const ok = { x: 0.5, y: 0.5, w: 0.4, h: 0.3, rot: 0 };
    expect(layoutSchema.safeParse(f({ ...ok, x: 1.5 })).success).toBe(false);
    expect(layoutSchema.safeParse(f({ ...ok, w: 0 })).success).toBe(false);
    expect(layoutSchema.safeParse(f({ ...ok, h: 2 })).success).toBe(false);
    expect(layoutSchema.safeParse(f({ ...ok, rot: 200 })).success).toBe(false);
    expect(layoutSchema.safeParse({ pages: [{ template: 'one', cells: Array.from({ length: 61 }, () => cell) }] }).success).toBe(false);
  });
  it('отклоняет слишком длинное название обложки', () => {
    const pages = [{ template: 'one', cells: [cell] }];
    expect(layoutSchema.safeParse({ pages, cover: { photoId: null, title: 'я'.repeat(101) } }).success).toBe(false);
  });
  it('сохраняет themeId, а макет без него остаётся валидным', () => {
    const pages = [{ template: 'one', cells: [{ photoId: null, crop: { x: 0, y: 0, scale: 1, rotation: 0 } }] }];
    expect(layoutSchema.parse({ pages, themeId: 'film' }).themeId).toBe('film');
    expect(layoutSchema.parse({ pages }).themeId).toBeUndefined();
  });
});

describe('formatByn', () => {
  it('форматирует копейки', () => {
    expect(formatByn(8740)).toBe('87,40 BYN');
  });
});

describe('личные страницы альбома', () => {
  const cell = { photoId: null, crop: { x: 0, y: 0, scale: 1, rotation: 0 } };
  const page = (extra: object) => ({ pages: [{ template: 'one', cells: [cell], ...extra }] });
  it('страница принимает memberId и qr с https-ссылкой', () => {
    const r = layoutSchema.parse(page({ memberId: 'u1', qr: { url: 'https://youtu.be/abc', x: 0.5, y: 0.7, size: 0.3 } }));
    expect(r.pages[0]).toMatchObject({ memberId: 'u1', qr: { size: 0.3 } });
  });
  it('qr отклоняет не-https ссылки, слишком длинные и неверный размер', () => {
    const qr = (over: object) => page({ qr: { url: 'https://x.by/v', x: 0.5, y: 0.7, size: 0.3, ...over } });
    expect(layoutSchema.safeParse(qr({ url: 'javascript:alert(1)' })).success).toBe(false);
    expect(layoutSchema.safeParse(qr({ url: 'http://x.by/v' })).success).toBe(false);
    expect(layoutSchema.safeParse(qr({ url: 'https://x.by/' + 'a'.repeat(300) })).success).toBe(false);
    expect(layoutSchema.safeParse(qr({ size: 0.9 })).success).toBe(false);
    expect(layoutSchema.safeParse(qr({ size: 0.05 })).success).toBe(false);
  });
  it('updateMyMemberRequestSchema: пожелание до 200 символов, видео только https', () => {
    expect(updateMyMemberRequestSchema.safeParse({ wish: 'ok' }).success).toBe(true);
    expect(updateMyMemberRequestSchema.safeParse({ videoUrl: null }).success).toBe(true);
    expect(updateMyMemberRequestSchema.safeParse({ wish: 'я'.repeat(120) }).success).toBe(true);
    expect(updateMyMemberRequestSchema.safeParse({ wish: 'я'.repeat(121) }).success).toBe(false);
    expect(updateMyMemberRequestSchema.safeParse({ videoUrl: 'https://' }).success).toBe(false);
    expect(updateMyMemberRequestSchema.safeParse({ videoUrl: 'HTTPS://x.by/v' }).success).toBe(true);
    expect(updateMyMemberRequestSchema.safeParse({ videoUrl: '  https://x.by/v  ' }).success).toBe(true);
    expect(updateMyMemberRequestSchema.safeParse({ videoUrl: 'ftp://x' }).success).toBe(false);
    expect(updateMyMemberRequestSchema.safeParse({ childName: '' }).success).toBe(false);
  });
  it('albumMemberSchema принимает wish и videoUrl (в том числе null)', () => {
    const m = { userId: 'u', childName: null, role: 'contributor', photosCount: 0 };
    expect(albumMemberSchema.safeParse({ ...m, wish: null, videoUrl: null }).success).toBe(true);
    expect(albumMemberSchema.safeParse({ ...m, wish: 'Удачи', videoUrl: 'https://x.by/v' }).success).toBe(true);
  });
});
