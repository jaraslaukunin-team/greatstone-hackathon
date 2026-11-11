import type { FastifyInstance } from 'fastify';
import type { ApiErrorBody } from '@picpac/shared';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function body(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send(body('NOT_FOUND', 'Такого адреса не существует'));
  });
  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send(body(err.code, err.message));
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply.status(status).send(body('BAD_REQUEST', 'Некорректный запрос'));
    }
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send(body('INTERNAL', 'Внутренняя ошибка сервера, попробуйте позже'));
  });
}
