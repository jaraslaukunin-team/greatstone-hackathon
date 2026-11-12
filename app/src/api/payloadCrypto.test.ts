import { encryptAesGcm, encryptJson, importRawAesKey, bytesToBase64, base64ToBytes } from './payloadCrypto';

describe('payloadCrypto', () => {
  it('bytesToBase64 / base64ToBytes обратимы', () => {
    const src = new Uint8Array([1, 2, 250, 255]);
    expect(Array.from(base64ToBytes(bytesToBase64(src)))).toEqual(Array.from(src));
  });

  it('encryptJson даёт blob v1 с iv/tag/data', async () => {
    const raw = new Uint8Array(32);
    raw.fill(7);
    const key = await importRawAesKey(bytesToBase64(raw));
    const blob = await encryptJson(key, { a: 1 });
    expect(blob.v).toBe(1);
    expect(blob.iv.length).toBeGreaterThan(8);
    expect(blob.tag.length).toBeGreaterThan(8);
    expect(blob.data.length).toBeGreaterThan(4);
    const again = await encryptAesGcm(key, new TextEncoder().encode('x'));
    expect(again.v).toBe(1);
  });
});
