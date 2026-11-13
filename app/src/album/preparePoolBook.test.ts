import type { PhotoDTO, ProjectDTO, VariantDTO } from '@picpac/shared';
import { preparePoolBook } from './preparePoolBook';

const variant: VariantDTO = {
  id: 'lite',
  productId: 'photobook',
  format: '15×15',
  pagesMin: 20,
  pagesMax: 40,
  basePriceKop: 7000,
  pricePerPageKop: 100,
  pageWidthCm: 15,
  minDpi: 150,
  leadTimeDays: 5,
};
const book: ProjectDTO = {
  id: 'book',
  title: 'Демо',
  variantId: variant.id,
  ownerId: 'demo',
  status: 'draft',
  isShared: false,
  expectedMembers: null,
  hasPassword: false,
  layout: { pages: [] },
  version: 1,
  updatedAt: '2026-11-01T10:00:00Z',
};
const photo: PhotoDTO = {
  id: 'photo',
  width: 2400,
  height: 1600,
  takenAt: '2026-09-01T12:00:00Z',
  url: '/files/photo',
  uploadedBy: 'demo',
  source: 'gallery',
  contentHash: null,
};

function client(project: ProjectDTO, photos = [photo]) {
  return {
    post: jest.fn().mockResolvedValue(project),
    get: jest.fn().mockResolvedValue(photos),
    put: jest.fn().mockResolvedValue({ version: 2 }),
  };
}

it('сохраняет макет личной книги перед переходом к трейлеру', async () => {
  const api = client(book);
  const result = await preparePoolBook(api, 'pool', [variant], new Map(), 'time-machine', () => 'travel');

  expect(api.post).toHaveBeenCalledWith('/projects/pool/fork');
  expect(api.get).toHaveBeenCalledWith('/projects/book/photos');
  expect(api.put).toHaveBeenCalledWith('/projects/book', { version: 1, layout: result.book.layout });
  expect(result.book.version).toBe(2);
  expect(result.book.layout.themeId).toBe('travel');
  expect(result.book.layout.pages).toHaveLength(20);
  expect(result.photoCount).toBe(1);
});

it('открывает сохранённую книгу и сохраняет ручные правки', async () => {
  const saved = { ...book, layout: { pages: [], cover: { title: 'Своё название', photoId: photo.id } } };
  const api = client(saved);
  const result = await preparePoolBook(api, 'pool', [variant], new Map(), 'time-machine', () => undefined);

  expect(result.book).toBe(saved);
  expect(api.put).not.toHaveBeenCalled();
});

it('оставляет обычный путь сборки по дням', async () => {
  const api = client(book);
  const result = await preparePoolBook(api, 'pool', [variant], new Map(), 'book', () => undefined);

  expect(result.book.layout.pages[0]?.cells[0]?.photoId).toBe(photo.id);
  expect(result.book.layout.pages[1]?.texts?.[0]?.text).toMatch(/1 сентября/);
  expect(result.book.layout.pages.some((page) => page.texts?.some((text) => text.style === 'quote'))).toBe(false);
});

it('с пустым набором фото не сохраняет черновик истории', async () => {
  const api = client(book, []);
  await expect(preparePoolBook(api, 'pool', [variant], new Map(), 'time-machine', () => undefined))
    .rejects.toThrow('Добавьте фотографии в общий альбом');
  expect(api.put).not.toHaveBeenCalled();
});
