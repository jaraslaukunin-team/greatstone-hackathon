import type { ProjectDTO } from '@picpac/shared';
import { myFork } from './myFork';

const base = (extra: Partial<ProjectDTO>): ProjectDTO => ({
  id: 'p',
  title: 't',
  variantId: 'v',
  ownerId: 'u1',
  status: 'draft',
  isShared: false,
  expectedMembers: null,
  hasPassword: false,
  layout: { pages: [] },
  version: 1,
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...extra,
});

describe('myFork', () => {
  it('находит книгу по sourceProjectId и владельцу', () => {
    const book = base({ id: 'mine', ownerId: 'u1', sourceProjectId: 'pool' });
    expect(myFork([book], 'pool', 'u1')?.id).toBe('mine');
  });

  it('не путает чужие книги и другие пулы', () => {
    const list = [
      base({ id: 'other', ownerId: 'u2', sourceProjectId: 'pool' }),
      base({ id: 'else', ownerId: 'u1', sourceProjectId: 'other-pool' }),
    ];
    expect(myFork(list, 'pool', 'u1')).toBeNull();
  });

  it('пустой список → null', () => {
    expect(myFork([], 'pool', 'u1')).toBeNull();
  });
});
