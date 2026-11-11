import type { ProjectDraft } from '../project/projectStore';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** UUID v4: сервер принимает Idempotency-Key только в таком виде. */
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function ensureIdempotencyKey(
  draft: ProjectDraft,
  setKey: (key: string) => void,
  createKey: () => string = newIdempotencyKey,
): string {
  // Ключ, сохранённый старой версией приложения, не uuid: заменяем его.
  if (draft.idempotencyKey && UUID.test(draft.idempotencyKey)) return draft.idempotencyKey;
  const key = createKey();
  setKey(key);
  return key;
}
