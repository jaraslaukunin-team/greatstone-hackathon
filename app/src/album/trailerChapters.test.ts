import type { Page, PageText } from '@picpac/shared';
import { trailerChapters } from './trailerChapters';

function sheet(...texts: PageText[]): Page {
  return { template: 'one', cells: [], texts };
}

const title: PageText = { style: 'title', text: 'Первая глава', x: 0.5, y: 0.4 };
const quote: PageText = { style: 'quote', text: 'Здесь всё начинается.', x: 0.5, y: 0.65 };

it('переводит страницы глав в индексы разворотов', () => {
  expect(trailerChapters({
    pages: [sheet(title), sheet(title, quote), sheet(), sheet({ ...title, text: '  Вторая глава  ' }, quote)],
  })).toEqual([
    { page: 1, spread: 1, title: 'Первая глава' },
    { page: 3, spread: 2, title: 'Вторая глава' },
  ]);
});

it('пропускает обложку, обычный заголовок и скрытую главу', () => {
  expect(trailerChapters({
    pages: [sheet(title, quote), sheet(title), sheet({ ...title, hidden: true }, quote)],
  })).toEqual([]);
});
