import {
  buildEventLayout,
  buildTimeMachineLayout,
  type PhotoDTO,
  type ProjectDTO,
  type VariantDTO,
} from '@picpac/shared';
import type { ApiClient } from '../api/client';
import { hasContent } from '../editor/reconcileLayout';

export async function preparePoolBook(
  client: Pick<ApiClient, 'post' | 'get' | 'put'>,
  poolId: string,
  variants: VariantDTO[],
  names: ReadonlyMap<string, string | null>,
  mode: 'book' | 'time-machine',
  themeFor: (bookId: string) => ProjectDTO['layout']['themeId'],
): Promise<{ book: ProjectDTO; photoCount: number; omitted: number }> {
  const book = await client.post<ProjectDTO>(`/projects/${poolId}/fork`);
  const variant = variants.find((item) => item.id === book.variantId);
  if (!variant) throw new Error('Не удалось определить формат книги');

  const path = `/projects/${book.id}`;
  const photos = await client.get<PhotoDTO[]>(`${path}/photos`);
  if (hasContent(book.layout)) return { book, photoCount: photos.length, omitted: 0 };
  if (mode === 'time-machine' && photos.length === 0) throw new Error('Добавьте фотографии в общий альбом');

  const build = mode === 'time-machine' ? buildTimeMachineLayout : buildEventLayout;
  const { layout, omitted } = build(
    photos.map((photo) => ({ ...photo, authorName: names.get(photo.uploadedBy ?? '') ?? null })),
    { title: book.title, limits: { pagesMin: variant.pagesMin, pagesMax: variant.pagesMax } },
  );
  const themeId = themeFor(book.id);
  if (themeId) layout.themeId = themeId;
  const saved = await client.put<{ version: number }>(path, { layout, version: book.version });
  return { book: { ...book, layout, version: saved.version }, photoCount: photos.length, omitted };
}
