import { getNetworkMessage, getPhotoReadMessage, getUnknownMessage } from '../i18n/localizeError';
import { useSettingsStore } from '../settings/settingsStore';
import {
  encryptAesGcm,
  encryptJson,
  hasAesGcm,
  importRawAesKey,
  base64ToBytes,
  bytesToBase64,
  type EncryptedBlobV1,
} from './payloadCrypto';

function asBufferSource(bytes: Uint8Array): BlobPart {
  return bytes as unknown as BlobPart;
}

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

function clientLang() {
  try {
    return useSettingsStore.getState().lang;
  } catch {
    return 'ru' as const;
  }
}

export class NetworkError extends Error {
  constructor(message = getNetworkMessage(clientLang())) {
    super(message);
    this.name = 'NetworkError';
  }
}

export type ApiClientOptions = {
  baseUrl: string;
  getToken: () => string | null;
  fetchImpl?: typeof fetch;
  shouldFailNetwork?: () => boolean;
  /** В тестах: не ходить за ключом / не шифровать. */
  disablePayloadEncryption?: boolean;
};

export type ApiClient = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
  put<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
  patch<T>(path: string, body?: unknown, headers?: Record<string, string>): Promise<T>;
  delete<T>(path: string, headers?: Record<string, string>): Promise<T>;
  /** Загружает файл с устройства как multipart в поле file. */
  upload<T>(path: string, file: { uri: string; name?: string; type?: string }): Promise<T>;
  /** Делает из относительной ссылки API (например, /files/...) полный адрес. */
  resolveUrl(path: string): string;
};

type ErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

const ENCRYPTED_JSON_PATHS = new Set(['/ai/chat', '/ai/edit', '/ai/adjust']);

function shouldEncryptJson(path: string): boolean {
  const bare = path.split('?')[0] ?? path;
  return ENCRYPTED_JSON_PATHS.has(bare);
}

function shouldEncryptUpload(path: string): boolean {
  return /\/projects\/[^/]+\/photos$/.test(path.split('?')[0] ?? path);
}

export function createApiClient(opts: ApiClientOptions): ApiClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  let keyCache: { token: string; key: CryptoKey } | null = null;
  let keyUnavailable = false;

  async function requestRaw(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<{ ok: boolean; status: number; data: unknown }> {
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

    let payload: string | FormData | undefined;
    if (body instanceof FormData) {
      payload = body;
    } else if (body !== undefined) {
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
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : String(err ?? '');
      const base = getNetworkMessage(clientLang());
      throw new NetworkError(detail && detail !== 'Network request failed' ? `${base}: ${detail}` : base);
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
    return { ok: response.ok, status: response.status, data };
  }

  function throwIfError(status: number, data: unknown): never {
    const err = data as ErrorBody | null;
    throw new ApiRequestError(
      status,
      err?.error?.code ?? 'UNKNOWN',
      err?.error?.message ?? getUnknownMessage(clientLang()),
    );
  }

  async function resolvePayloadKey(): Promise<CryptoKey | null> {
    if (opts.disablePayloadEncryption || keyUnavailable) return null;
    // Expo Go / React Native: без crypto.subtle шлём фото и AI-тела открытым текстом (API это допускает).
    if (!hasAesGcm()) {
      keyUnavailable = true;
      return null;
    }
    const token = opts.getToken();
    if (!token) return null;
    if (keyCache?.token === token) return keyCache.key;

    const res = await requestRaw('GET', '/crypto/client-key');
    if (res.status === 503) {
      keyUnavailable = true;
      return null;
    }
    if (!res.ok) throwIfError(res.status, res.data);
    const keyB64 = (res.data as { key?: string } | null)?.key;
    if (!keyB64) {
      keyUnavailable = true;
      return null;
    }
    try {
      const key = await importRawAesKey(keyB64);
      keyCache = { token, key };
      return key;
    } catch {
      keyUnavailable = true;
      return null;
    }
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    let nextBody = body;
    if (
      body !== undefined &&
      !(body instanceof FormData) &&
      method !== 'GET' &&
      shouldEncryptJson(path)
    ) {
      const key = await resolvePayloadKey();
      if (key) {
        nextBody = await encryptJson(key, body);
      }
    }

    const res = await requestRaw(method, path, nextBody, headers);
    if (!res.ok) throwIfError(res.status, res.data);
    return res.data as T;
  }

  async function readFileBytes(uri: string): Promise<Uint8Array> {
    if (typeof document !== 'undefined' || uri.startsWith('blob:') || uri.startsWith('data:')) {
      try {
        const buf = await (await fetchImpl(uri)).arrayBuffer();
        return new Uint8Array(buf);
      } catch {
        throw new NetworkError(getPhotoReadMessage(useSettingsStore.getState().lang));
      }
    }
    // React Native: читаем через fetch file:// или FileSystem, если доступен.
    try {
      const res = await fetchImpl(uri);
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      // fallback: expo-file-system base64
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const FileSystem = require('expo-file-system') as {
          readAsStringAsync(uri: string, opts: { encoding: string }): Promise<string>;
          EncodingType: { Base64: string };
        };
        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return base64ToBytes(b64);
      } catch {
        throw new NetworkError(getPhotoReadMessage(useSettingsStore.getState().lang));
      }
    }
  }

  async function uploadEncrypted(
    path: string,
    file: { uri: string; name: string; type: string },
    key: CryptoKey,
  ): Promise<EncryptedBlobV1 & { bytes: Uint8Array }> {
    const plain = await readFileBytes(file.uri);
    const blob = await encryptAesGcm(key, plain);
    const cipherBytes = base64ToBytes(blob.data);
    return { ...blob, bytes: cipherBytes };
  }

  async function upload<T>(path: string, file: { uri: string; name?: string; type?: string }): Promise<T> {
    const name = file.name ?? 'photo.jpg';
    const type = file.type ?? 'image/jpeg';
    const form = new FormData();

    const encrypt = shouldEncryptUpload(path) ? await resolvePayloadKey() : null;
    if (encrypt) {
      const enc = await uploadEncrypted(path, { uri: file.uri, name, type }, encrypt);
      form.append('enc', 'aes-gcm-v1');
      form.append('iv', enc.iv);
      form.append('tag', enc.tag);
      const cipherBlob = new Blob([asBufferSource(enc.bytes)]);
      if (typeof document !== 'undefined') {
        form.append('file', cipherBlob, name);
      } else {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const FileSystem = require('expo-file-system') as {
            cacheDirectory: string | null;
            writeAsStringAsync(uri: string, data: string, opts: { encoding: string }): Promise<void>;
            EncodingType: { Base64: string };
          };
          const dir = FileSystem.cacheDirectory ?? '';
          const tmp = `${dir}enc-upload-${Date.now()}.bin`;
          await FileSystem.writeAsStringAsync(tmp, bytesToBase64(enc.bytes), {
            encoding: FileSystem.EncodingType.Base64,
          });
          form.append('file', { uri: tmp, name, type: 'application/octet-stream' } as unknown as Blob);
        } catch {
          form.append('file', cipherBlob, name);
        }
      }
    } else if (typeof document !== 'undefined') {
      let blob: Blob;
      try {
        blob = await (await fetchImpl(file.uri)).blob();
      } catch {
        throw new NetworkError(getPhotoReadMessage(useSettingsStore.getState().lang));
      }
      form.append('file', blob, name);
    } else {
      // Expo Go / RN: нативный multipart надёжнее, чем FormData+fetch с { uri }.
      try {
        return await uploadNativeMultipart<T>(path, { uri: file.uri, name, type });
      } catch (e) {
        if (!(e instanceof NetworkError)) throw e;
        form.append('file', { uri: file.uri, name, type } as unknown as Blob);
      }
    }

    return request<T>('POST', path, form);
  }

  async function uploadNativeMultipart<T>(
    path: string,
    file: { uri: string; name: string; type: string },
  ): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const FileSystem = require('expo-file-system/legacy') as {
      uploadAsync(
        url: string,
        fileUri: string,
        options: {
          httpMethod: string;
          uploadType: number;
          fieldName: string;
          mimeType?: string;
          headers?: Record<string, string>;
        },
      ): Promise<{ status: number; body: string }>;
      FileSystemUploadType: { MULTIPART: number };
    };
    const token = opts.getToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    let result: { status: number; body: string };
    try {
      result = await FileSystem.uploadAsync(`${opts.baseUrl}${path}`, file.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: file.type,
        headers,
      });
    } catch (err) {
      const detail = err instanceof Error && err.message ? err.message : String(err ?? '');
      const base = getNetworkMessage(clientLang());
      throw new NetworkError(detail ? `${base}: ${detail}` : base);
    }
    let data: unknown = null;
    if (result.body) {
      try {
        data = JSON.parse(result.body) as unknown;
      } catch {
        data = null;
      }
    }
    if (result.status < 200 || result.status >= 300) throwIfError(result.status, data);
    return data as T;
  }

  return {
    upload,
    resolveUrl: (path: string) => (/^https?:/i.test(path) ? path : `${opts.baseUrl}${path}`),
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
