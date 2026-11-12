import type { CatalogDTO, ProductDTO, ProjectDTO } from '@picpac/shared';

export type ProjectKind = ProductDTO['kind'];

const KIND_LABEL: Record<ProjectKind, string> = {
  photobook: 'Фотокнига',
  prints: 'Печать',
  graduation: 'Выпускной альбом',
};

/** Тип продукта проекта по variantId из каталога. */
export function projectKind(project: ProjectDTO, catalog: CatalogDTO | null | undefined): ProjectKind | null {
  if (!catalog) return null;
  for (const product of catalog.products) {
    if (product.variants.some((v) => v.id === project.variantId)) {
      return product.kind;
    }
  }
  return null;
}

export function projectKindLabel(kind: ProjectKind | null): string {
  if (!kind) return 'Проект';
  return KIND_LABEL[kind];
}
