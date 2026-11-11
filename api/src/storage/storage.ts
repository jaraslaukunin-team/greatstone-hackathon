// Хранилище файлов: сейчас диск VPS, позже можно заменить на объектное хранилище.
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
