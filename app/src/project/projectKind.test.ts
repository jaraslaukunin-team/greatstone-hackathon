import type { CatalogDTO, ProjectDTO } from '@picpac/shared';
import { projectKind, projectKindLabel } from './projectKind';

const catalog: CatalogDTO = {
  products: [
    {
      id: 'p1',
      kind: 'photobook',
      line: null,
      title: 'Classic',
      description: '',
      variants: [
        {
          id: 'v-book',
          productId: 'p1',
          format: '20×20',
          pagesMin: 20,
          pagesMax: 60,
          basePriceKop: 7000,
          pricePerPageKop: 100,
          minDpi: 200,
          pageWidthCm: 20,
          leadTimeDays: 5,
        },
      ],
    },
    {
      id: 'p2',
      kind: 'prints',
      line: 'photo',
      title: 'Печать',
      description: '',
      variants: [
        {
          id: 'v-print',
          productId: 'p2',
          format: '10×15',
          pagesMin: 1,
          pagesMax: 1,
          basePriceKop: 50,
          pricePerPageKop: 0,
          minDpi: 200,
          pageWidthCm: 10,
          leadTimeDays: 2,
        },
      ],
    },
  ],
  delivery: [],
  limits: { maxPhotoBytes: 1, allowedMimeTypes: ['image/jpeg'] },
};

function project(variantId: string): ProjectDTO {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Тест',
    variantId,
    ownerId: 'u1',
    status: 'draft',
    isShared: false,
    expectedMembers: null,
    hasPassword: false,
    layout: { pages: [] },
    version: 1,
    updatedAt: '2026-11-12T00:00:00.000Z',
  };
}

describe('projectKind', () => {
  it('находит фотокнигу и печать по variantId', () => {
    expect(projectKind(project('v-book'), catalog)).toBe('photobook');
    expect(projectKind(project('v-print'), catalog)).toBe('prints');
  });

  it('возвращает null без каталога или неизвестного варианта', () => {
    expect(projectKind(project('v-book'), null)).toBeNull();
    expect(projectKind(project('missing'), catalog)).toBeNull();
  });

  it('даёт русскую подпись', () => {
    expect(projectKindLabel('graduation')).toBe('Выпускной альбом');
    expect(projectKindLabel(null)).toBe('Проект');
  });
});
