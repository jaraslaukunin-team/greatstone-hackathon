/** Деньги хранятся целыми копейками. */
export type Kopecks = number;

/** 8740 -> "87,40 BYN" (запятая как разделитель, без разделителей тысяч). */
export function formatByn(k: Kopecks): string {
  const sign = k < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(k));
  const rub = Math.floor(abs / 100);
  const kop = String(abs % 100).padStart(2, '0');
  return `${sign}${rub},${kop} BYN`;
}
