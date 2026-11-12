import { describe, it, expect } from 'vitest';
import { createOrderRequestSchema, layoutSchema } from './schemas';
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
