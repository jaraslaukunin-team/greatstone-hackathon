import { qrMatrix } from './qrMatrix';

describe('qrMatrix', () => {
  it('для https-ссылки даёт квадратную матрицу с тёмными и светлыми модулями', () => {
    const m = qrMatrix('https://youtu.be/abc')!;
    expect(m).not.toBeNull();
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    const flat = m.flat();
    expect(flat.some(Boolean)).toBe(true);
    expect(flat.some((v) => !v)).toBe(true);
    // Угловой поисковый квадрат всегда тёмный.
    expect(m[0]![0]).toBe(true);
    expect(m[0]![m.length - 1]).toBe(true);
    expect(m[m.length - 1]![0]).toBe(true);
  });

  it('небезопасные и пустые ссылки не кодируются', () => {
    expect(qrMatrix('javascript:alert(1)')).toBeNull();
    expect(qrMatrix('http://x.by/v')).toBeNull();
    expect(qrMatrix('ftp://x.by/v')).toBeNull();
    expect(qrMatrix('')).toBeNull();
    expect(qrMatrix('не ссылка')).toBeNull();
  });

  it('одинаковая ссылка даёт одинаковую матрицу', () => {
    expect(qrMatrix('https://x.by/v')).toEqual(qrMatrix('https://x.by/v'));
  });
});
