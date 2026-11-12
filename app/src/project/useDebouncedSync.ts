import type { Layout } from '@picpac/shared';
import { useEffect, useMemo, useRef } from 'react';
import type { ApiClient } from '../api/client';
import { createDebouncedSaver } from './debouncedSaver';
import { useProjectStore } from './projectStore';
import { syncProject } from './syncProject';

const DELAY_MS = 1000;

/**
 * Сохраняет макет на сервер через секунду после последней правки, без кнопки «Сохранить».
 * Пока enabled = false (книга ещё собирается), изменения не отправляются; при включении текущий макет
 * принимается за исходный. При закрытии экрана последняя правка уходит сразу.
 */
export function useDebouncedSync(client: ApiClient, projectId: string | undefined, enabled: boolean) {
  const layout = useProjectStore((s) => s.draft?.layout);
  const setSyncState = useProjectStore((s) => s.setSyncState);
  const baseline = useRef<Layout | undefined>(undefined);

  const saver = useMemo(() => {
    async function save(next: Layout, retried = false): Promise<void> {
      const draft = useProjectStore.getState().draft;
      if (!projectId || !draft || draft.project.id !== projectId) return;
      setSyncState('saving');
      await syncProject({
        client,
        projectId,
        layout: next,
        version: draft.project.version,
        onLocalOnly: () => setSyncState('local-only'),
        onSaved: ({ version }) => {
          useProjectStore.setState((s) =>
            s.draft ? { draft: { ...s.draft, project: { ...s.draft.project, version } }, syncState: 'saved' } : s,
          );
        },
        // Макет изменили с другого устройства: берём версию сервера и один раз повторяем с нашим макетом.
        onConflict: async (server) => {
          useProjectStore.setState((s) =>
            s.draft ? { draft: { ...s.draft, project: { ...s.draft.project, version: server.version } } } : s,
          );
          if (retried) setSyncState('local-only');
          else await save(next, true);
        },
      });
    }
    return createDebouncedSaver<Layout>((next) => save(next), DELAY_MS);
  }, [client, projectId, setSyncState]);

  useEffect(() => {
    if (!enabled) {
      baseline.current = undefined;
      return;
    }
    if (baseline.current === undefined) {
      baseline.current = layout;
      return;
    }
    if (layout && layout !== baseline.current) {
      baseline.current = layout;
      saver.schedule(layout);
    }
  }, [enabled, layout, saver]);

  // Закрыли экран — последняя правка не теряется.
  useEffect(() => () => saver.flush(), [saver]);

  return { flush: saver.flush };
}
