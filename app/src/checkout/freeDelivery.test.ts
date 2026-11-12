import { freeDeliveryHint, leftToFree } from './freeDelivery';

describe('leftToFree', () => {
  it('возвращает 0 если сумма превышает порог', () => {
    expect(leftToFree(30000, 15000)).toBe(0);
  });
  it('возвращает разницу если ниже порога', () => {
    expect(leftToFree(10000, 15000)).toBe(5000);
  });
  it('возвращает 0 если порог null', () => {
    expect(leftToFree(10000, null)).toBe(0);
  });
  it('возвращает 0 если ровно на пороге', () => {
    expect(leftToFree(15000, 15000)).toBe(0);
  });
});

describe('freeDeliveryHint', () => {
  it('возвращает null если доставка уже бесплатна', () => {
    expect(freeDeliveryHint(30000, 15000)).toBeNull();
  });
  it('возвращает null если порог null', () => {
    expect(freeDeliveryHint(100, null)).toBeNull();
  });
  it('возвращает строку с суммой', () => {
    const hint = freeDeliveryHint(10000, 15000);
    expect(hint).not.toBeNull();
    expect(hint).toContain('50');
  });
});
