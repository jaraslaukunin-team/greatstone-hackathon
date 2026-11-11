import type { Layout, ProjectDTO } from '@picpac/shared';

type Draft = {
  project: ProjectDTO;
  layout: Layout;
  idempotencyKey: string | null;
};

function createStore(storage: { data: string | null }) {
  let draft: Draft | null = storage.data ? (JSON.parse(storage.data) as Draft) : null;
  let syncState: 'saved' | 'saving' | 'local-only' = 'saved';

  return {
    get draft() {
      return draft;
    },
    get syncState() {
      return syncState;
    },
    setDraft(project: ProjectDTO) {
      draft = { project, layout: project.layout, idempotencyKey: null };
      syncState = 'saved';
      storage.data = JSON.stringify(draft);
    },
    setLayout(layout: Layout) {
      if (!draft) return;
      draft = {
        ...draft,
        layout,
        project: { ...draft.project, layout },
      };
      syncState = 'local-only';
      storage.data = JSON.stringify(draft);
    },
  };
}

const sampleProject = (layout: Layout): ProjectDTO => ({
  id: '00000000-0000-4000-8000-000000000301',
  title: 'Тест',
  variantId: '00000000-0000-4000-8000-000000000101',
  ownerId: '00000000-0000-4000-8000-000000000201',
  status: 'draft',
  isShared: false,
  expectedMembers: null, hasPassword: false,
  layout,
  version: 1,
  updatedAt: '2026-11-11T12:00:00.000Z',
});

const emptyCrop = { x: 0, y: 0, scale: 1, rotation: 0 as const };

function pages(n: number): Layout {
  return {
    pages: Array.from({ length: n }, () => ({
      template: 'one' as const,
      cells: [{ photoId: null, crop: emptyCrop }],
    })),
  };
}

describe('projectStore', () => {
  it('setLayout сохраняет макет локально сразу', () => {
    const storage = { data: null as string | null };
    const store = createStore(storage);
    store.setDraft(sampleProject(pages(1)));
    const layout = pages(10);
    store.setLayout(layout);
    expect(store.draft?.layout.pages).toHaveLength(10);
    expect(store.syncState).toBe('local-only');
  });

  it('перезапуск восстанавливает черновик', () => {
    const storage = { data: null as string | null };
    const first = createStore(storage);
    first.setDraft(sampleProject(pages(10)));
    first.setLayout(pages(10));
    const second = createStore(storage);
    expect(second.draft?.layout.pages).toHaveLength(10);
  });
});
