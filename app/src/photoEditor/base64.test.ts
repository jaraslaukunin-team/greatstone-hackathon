import { bytesToBase64 } from './base64';

describe('bytesToBase64', () => {
  it('кодирует известные строки (все варианты добивки)', () => {
    const enc = (s: string) => bytesToBase64(new TextEncoder().encode(s));
    expect(enc('')).toBe('');
    expect(enc('f')).toBe('Zg==');
    expect(enc('fo')).toBe('Zm8=');
    expect(enc('foo')).toBe('Zm9v');
    expect(enc('Hello')).toBe('SGVsbG8=');
  });

  it('совпадает с Buffer на больших данных со всеми значениями байта', () => {
    const bytes = new Uint8Array(200_003).map((_, i) => (i * 31 + 7) % 256);
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
  });
});
