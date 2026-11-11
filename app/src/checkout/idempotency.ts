import type { ProjectDraft } from '../project/projectStore';

export function ensureIdempotencyKey(
  draft: ProjectDraft,
  setKey: (key: string) => void,
  createKey: () => string = () =>
    `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
): string {
  if (draft.idempotencyKey) return draft.idempotencyKey;
  const key = createKey();
  setKey(key);
  return key;
}
