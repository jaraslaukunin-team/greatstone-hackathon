import { ApiRequestError, NetworkError, createApiClient } from './client';

describe('createApiClient', () => {
  it('подставляет Authorization: Bearer', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = createApiClient({
      baseUrl: 'http://localhost:3000',
      getToken: () => 'tok-123',
      fetchImpl,
    });

    await client.get('/me');

    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: 'Bearer tok-123',
    });
  });

  it('превращает ответ с error.code в ApiRequestError', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          error: { code: 'PRICE_CHANGED', message: 'Цена изменилась' },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );

    const client = createApiClient({
      baseUrl: 'http://localhost:3000',
      getToken: () => null,
      fetchImpl,
    });

    await expect(client.post('/orders', {})).rejects.toMatchObject({
      name: 'ApiRequestError',
      code: 'PRICE_CHANGED',
      status: 409,
    } satisfies Partial<ApiRequestError>);
  });

  it('превращает отказ fetch в NetworkError', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError('Failed to fetch');
    };

    const client = createApiClient({
      baseUrl: 'http://localhost:3000',
      getToken: () => null,
      fetchImpl,
    });

    await expect(client.get('/health')).rejects.toBeInstanceOf(NetworkError);
  });

  it('upload шлёт multipart без JSON-заголовка и дополняет относительные адреса', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ id: 'p1' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    };
    const client = createApiClient({ baseUrl: 'http://localhost:3000', getToken: () => 't', fetchImpl });

    await client.upload('/projects/x/photos', { uri: 'file:///a.jpg' });

    expect(calls[0]?.init?.body).toBeInstanceOf(FormData);
    expect(calls[0]?.init?.headers).not.toHaveProperty('Content-Type');
    expect(client.resolveUrl('/files/1?sig=2')).toBe('http://localhost:3000/files/1?sig=2');
    expect(client.resolveUrl('https://cdn.example/a.jpg')).toBe('https://cdn.example/a.jpg');
  });
});
