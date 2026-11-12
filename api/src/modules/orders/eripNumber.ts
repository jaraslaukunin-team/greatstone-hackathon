import { randomInt } from 'node:crypto';

const CHUNK = 9;
const CHUNK_MAX = 10 ** CHUNK; // 1_000_000_000

/** Генерирует 27-значный номер ЕРИП как строку (три случайных девятизначных блока). */
export function newEripNumber(): string {
  const a = randomInt(CHUNK_MAX).toString().padStart(CHUNK, '0');
  const b = randomInt(CHUNK_MAX).toString().padStart(CHUNK, '0');
  const c = randomInt(CHUNK_MAX).toString().padStart(CHUNK, '0');
  return a + b + c;
}
