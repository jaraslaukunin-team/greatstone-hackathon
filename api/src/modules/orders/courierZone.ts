/** Города, в которые работает курьерская доставка. */
const COURIER_CITIES = new Set(['минск', 'minsk']);

/**
 * Проверяет, входит ли город в зону курьерской доставки.
 * Сравнение без учёта регистра и пробелов по краям.
 */
export function isCourierZone(city: string): boolean {
  return COURIER_CITIES.has(city.trim().toLowerCase());
}
