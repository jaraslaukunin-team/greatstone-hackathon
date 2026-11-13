export type UploadTask = {
  localId: string;
  projectId: string;
  uri: string;
};

export type QueueItem = UploadTask & {
  status: 'queued' | 'uploading' | 'done' | 'error';
  attempts: number;
  progress: number;
  error?: string;
};

export type QueueState = {
  items: QueueItem[];
};

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

type Deps = {
  upload: (task: UploadTask) => Promise<unknown>;
  storage: KeyValueStore;
  isOnline: () => boolean;
  maxAttempts?: number;
  storageKey?: string;
  delay?: (ms: number) => Promise<void>;
};

const DEFAULT_KEY = 'picpac.upload-queue';

export class UploadQueue {
  private items: QueueItem[] = [];
  private listeners = new Set<(state: QueueState) => void>();
  private pumpPromise: Promise<void> | null = null;
  private readonly maxAttempts: number;
  private readonly storageKey: string;
  private readonly delay: (ms: number) => Promise<void>;

  constructor(private readonly deps: Deps) {
    this.maxAttempts = deps.maxAttempts ?? 5;
    this.storageKey = deps.storageKey ?? DEFAULT_KEY;
    this.delay = deps.delay ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async hydrate(): Promise<void> {
    const raw = await this.deps.storage.getItem(this.storageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as QueueItem[];
      // blob:-адрес живёт только до перезагрузки страницы: такая запись уже не откроется и висела бы вечно.
      this.items = parsed.filter((item) => item.status !== 'done' && !item.uri.startsWith('blob:'));
      if (this.items.length !== parsed.length) void this.persist();
      this.emit();
    } catch {
      // ignore corrupt storage
    }
  }

  enqueue(task: UploadTask): void {
    if (this.items.some((item) => item.localId === task.localId)) return;
    this.items.push({
      ...task,
      status: 'queued',
      attempts: 0,
      progress: 0,
    });
    void this.persist();
    this.emit();
    void this.pump();
  }

  onChange(cb: (state: QueueState) => void): () => void {
    this.listeners.add(cb);
    cb(this.snapshot());
    return () => this.listeners.delete(cb);
  }

  async resume(): Promise<void> {
    await this.pump();
  }

  private snapshot(): QueueState {
    return { items: this.items.map((item) => ({ ...item })) };
  }

  private emit() {
    const state = this.snapshot();
    for (const listener of this.listeners) listener(state);
  }

  private async persist() {
    await this.deps.storage.setItem(this.storageKey, JSON.stringify(this.items));
  }

  private pump(): Promise<void> {
    if (this.pumpPromise) return this.pumpPromise;
    this.pumpPromise = this.runPump().finally(() => {
      this.pumpPromise = null;
    });
    return this.pumpPromise;
  }

  private async runPump() {
    while (true) {
      if (!this.deps.isOnline()) break;
      const next = this.items.find(
        (item) =>
          (item.status === 'queued' || item.status === 'error') && item.attempts < this.maxAttempts,
      );
      if (!next) break;

      next.status = 'uploading';
      next.progress = 0.1;
      next.attempts += 1;
      this.emit();
      await this.persist();

      try {
        await this.deps.upload({
          localId: next.localId,
          projectId: next.projectId,
          uri: next.uri,
        });
        next.status = 'done';
        next.progress = 1;
      } catch (e) {
        next.status = 'error';
        next.error = e instanceof Error ? e.message : 'Ошибка загрузки';
        await this.delay(Math.min(1000 * 2 ** (next.attempts - 1), 8000));
        this.emit();
        await this.persist();
        continue;
      }
      this.emit();
      await this.persist();
    }
  }
}
