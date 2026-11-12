const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64 из байтов без btoa и Buffer: на телефоне они есть не везде, а файл может весить мегабайты. */
export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const n = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    chunk +=
      ALPHABET[(n >> 18) & 63]! +
      ALPHABET[(n >> 12) & 63]! +
      (b1 === undefined ? '=' : ALPHABET[(n >> 6) & 63]!) +
      (b2 === undefined ? '=' : ALPHABET[n & 63]!);
    // Копим порциями: одна гигантская строка в цикле дорогая по памяти.
    if (chunk.length >= 32768) {
      parts.push(chunk);
      chunk = '';
    }
  }
  parts.push(chunk);
  return parts.join('');
}
