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

const HTTP_ERRORS: Record<number, [string, string]> = {
  400: ['BAD_REQUEST', 'Некорректный запрос'],
  404: ['NOT_FOUND', 'Такого адреса не существует'],
  413: ['PAYLOAD_TOO_LARGE', 'Слишком большой запрос'],
  415: ['UNSUPPORTED_MEDIA_TYPE', 'Неподдерживаемый тип содержимого'],
  429: ['TOO_MANY_REQUESTS', 'Слишком много запросов, попробуйте позже'],
};

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
      const [code, message] = HTTP_ERRORS[status] ?? [
        `HTTP_${status}`,
        'Запрос не может быть обработан',
      ];
      return reply.status(status).send(body(code, message));
    }
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send(body('INTERNAL', 'Внутренняя ошибка сервера, попробуйте позже'));
  });
}
