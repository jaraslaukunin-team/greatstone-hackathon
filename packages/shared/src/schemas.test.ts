import { describe, expect, it } from 'vitest';
import { createOrderRequestSchema, layoutSchema } from './schemas.js';
import { formatByn } from './money.js';

describe('createOrderRequestSchema', () => {
  it('принимает валидный заказ', () => {
    const parsed = createOrderRequestSchema.parse({
      projectId: '11111111-1111-4111-8111-111111111111',
      delivery: 'ems',
      expectedTotalKop: 8790,
    });
    expect(parsed.delivery).toBe('ems');
    expect(parsed.expectedTotalKop).toBe(8790);
  });

  it('отклоняет неизвестный способ доставки', () => {
    expect(() =>
      createOrderRequestSchema.parse({
        projectId: '11111111-1111-4111-8111-111111111111',
        delivery: 'dhl',
        expectedTotalKop: 8790,
      }),
    ).toThrow();
  });

  it('отклоняет дробную сумму', () => {
    expect(() =>
      createOrderRequestSchema.parse({
        projectId: '11111111-1111-4111-8111-111111111111',
        delivery: 'ems',
        expectedTotalKop: 8790.5,
      }),
    ).toThrow();
  });
});

describe('layoutSchema', () => {
  it('отклоняет scale: 0', () => {
    expect(() =>
      layoutSchema.parse({
        pages: [
          {
            template: 'one',
            cells: [
              {
                photoId: null,
                crop: { x: 0, y: 0, scale: 0, rotation: 0 },
              },
            ],
          },
        ],
      }),
    ).toThrow();
  });
});

describe('formatByn', () => {
  it('форматирует копейки с запятой', () => {
    expect(formatByn(8740)).toBe('87,40 BYN');
  });
});
