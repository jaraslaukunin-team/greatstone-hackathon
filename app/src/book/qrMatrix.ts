import { httpsUrlSchema } from '@picpac/shared';
import qrcode from 'qrcode-generator';

/**
 * Матрица QR-кода (true — тёмный модуль) для https-ссылки. Другие схемы (javascript:, http:, ftp:) и не-ссылки
 * не кодируются и дают null: в печатный макет попадает только безопасная ссылка.
 */
export function qrMatrix(url: string): boolean[][] | null {
  if (!httpsUrlSchema.safeParse(url).success) return null;
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}
