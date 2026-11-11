import type { z } from 'zod';
import { AppError } from './errors.js';

// Единый разбор тела запроса: любая ошибка схемы даёт 400 BAD_REQUEST.
export function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError(400, 'BAD_REQUEST', 'Некорректные данные запроса');
  return r.data;
}
