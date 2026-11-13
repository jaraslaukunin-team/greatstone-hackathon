import type { Layout } from '@picpac/shared';
import { spreadsOf } from '../book/flip';

export function trailerChapters(layout: Layout): { page: number; spread: number; title: string }[] {
  return spreadsOf(layout.pages.length).flatMap((spread, index) =>
    spread.flatMap((page) => {
      if (page === null || page === 0) return [];
      const sheet = layout.pages[page];
      if (!sheet || sheet.cells.some((cell) => cell.photoId !== null && !cell.hidden)) return [];
      // В Time Machine страница главы — отдельный лист с заголовком и цитатой.
      if (!sheet.texts?.some((layer) => layer.style === 'quote' && !layer.hidden)) return [];
      const title = sheet.texts?.find((layer) => layer.style === 'title' && !layer.hidden)?.text.trim();
      return title ? [{ page, spread: index, title }] : [];
    }),
  );
}
