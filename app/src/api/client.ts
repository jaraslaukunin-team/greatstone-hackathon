export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Нет соединения с сервером') {
    super(message);
    this.name = 'NetworkError';
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getToken: () => string | null;
  fetchImpl?: typeof fetch;
  shouldFailNetwork?: () => boolean;
};

export type ApiClient = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
  put<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
  patch<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
  delete<T>(path: string, headers?: Record<string, string>): Promise<T>;
};

type ErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const fetchImpl = opts.fetchImpl ?? fetch;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    if (opts.shouldFailNetwork?.()) {
      throw new NetworkError();
    }

    const token = opts.getToken();
    const nextHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...headers,
    };

    if (token) {
      nextHeaders.Authorization = `Bearer ${token}`;
    }

    let payload: string | undefined;
    if (body !== undefined) {
      nextHeaders['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }

    let response: Response;
    try {
      response = await fetchImpl(`${opts.baseUrl}${path}`, {
        method,
        headers: nextHeaders,
        body: payload,
      });
    } catch {
      throw new NetworkError();
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const err = data as ErrorBody | null;
      throw new ApiRequestError(
        response.status,
        err?.error?.code ?? 'UNKNOWN',
        err?.error?.message ?? 'Неизвестная ошибка',
      );
    }

    return data as T;
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
      request<T>('POST', path, body, headers),
    put: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
      request<T>('PUT', path, body, headers),
    patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
      request<T>('PATCH', path, body, headers),
    delete: <T>(path: string, headers?: Record<string, string>) =>
      request<T>('DELETE', path, undefined, headers),
  };
}
