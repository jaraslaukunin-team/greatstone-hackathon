import { createHmac, timingSafeEqual } from 'node:crypto';

const mac = (photoId: string, exp: number, secret: string): string =>
  createHmac('sha256', secret).update(`${photoId}.${exp}`).digest('hex');

// Относительная ссылка: приложение добавляет адрес API. Срок задаёт вызывающий (читает app.clock).
export function signUrl(photoId: string, expiresAt: Date, secret: string): string {
  const exp = Math.floor(expiresAt.getTime() / 1000);
  return `/files/${photoId}?exp=${exp}&sig=${mac(photoId, exp, secret)}`;
}

// Подпись для произвольного предмета (не только фото): так подписываются вложения обращений,
// предмет — «обращение:сообщение», поэтому подпись одного сообщения не открывает другое.
export function signSubject(subject: string, expiresAt: Date, secret: string): { exp: number; sig: string } {
  const exp = Math.floor(expiresAt.getTime() / 1000);
  return { exp, sig: mac(subject, exp, secret) };
}

// Ссылка действует, пока now < exp.
export function verifySignature(photoId: string, exp: number, sig: string, secret: string, now: Date): boolean {
  if (!Number.isInteger(exp) || now.getTime() >= exp * 1000) return false;
  const expected = Buffer.from(mac(photoId, exp, secret));
  const got = Buffer.from(sig);
  return got.length === expected.length && timingSafeEqual(got, expected);
}
