/** Envelope AES-256-GCM для тел запросов клиент↔API (тот же формат, что на сервере). */

export type EncryptedBlobV1 = {
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('В этой среде нет Web Crypto (AES-GCM)');
  }
  return subtle;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function asBufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

export async function importRawAesKey(base64Key: string): Promise<CryptoKey> {
  const raw = base64ToBytes(base64Key);
  return getSubtle().importKey('raw', asBufferSource(raw), { name: 'AES-GCM' }, false, ['encrypt']);
}

export async function encryptAesGcm(key: CryptoKey, plaintext: Uint8Array): Promise<EncryptedBlobV1> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await getSubtle().encrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv), tagLength: 128 },
      key,
      asBufferSource(plaintext),
    ),
  );
  // Web Crypto: ciphertext || tag (16 байт в конце).
  const tag = cipher.slice(cipher.length - 16);
  const data = cipher.slice(0, cipher.length - 16);
  return {
    v: 1,
    iv: bytesToBase64(iv),
    tag: bytesToBase64(tag),
    data: bytesToBase64(data),
  };
}

export async function encryptJson(key: CryptoKey, body: unknown): Promise<EncryptedBlobV1> {
  const text = new TextEncoder().encode(JSON.stringify(body));
  return encryptAesGcm(key, text);
}
