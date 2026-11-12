/** Убирает из текста к aiai явные контакты/адреса (обезличивание). */
export function sanitizeForExternalLlm(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[contact]')
    .replace(/\+?\d[\d\s\-()]{8,}\d/g, '[phone]')
    .replace(/\b\d{6}\b/g, '[index]')
    .trim();
}
