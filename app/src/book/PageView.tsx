import { fitRect, type Cell, type Page, type PhotoDTO } from '@picpac/shared';
import { Image, StyleSheet, View } from 'react-native';
import { lightColors } from '../theme/theme';

type Props = {
  page: Page | null;
  photos: Map<string, PhotoDTO>;
  resolveUrl: (path: string) => string;
  width: number;
  height: number;
};

const GAP = 4;

/** Раскладка ячеек страницы по шаблону: 1, 2 в ряд, 4 в сетке 2×2. */
export function cellRects(template: Page['template'], width: number, height: number, count: number) {
  const g = GAP;
  if (template === 'two' && count >= 2) {
    const w = (width - g * 3) / 2;
    return [0, 1].map((i) => ({ x: g + i * (w + g), y: g, width: w, height: height - g * 2 }));
  }
  if (template === 'four' && count >= 4) {
    const w = (width - g * 3) / 2;
    const h = (height - g * 3) / 2;
    return [0, 1, 2, 3].map((i) => ({ x: g + (i % 2) * (w + g), y: g + Math.floor(i / 2) * (h + g), width: w, height: h }));
  }
  return [{ x: g, y: g, width: width - g * 2, height: height - g * 2 }];
}

function CellView({ cell, rect, photos, resolveUrl }: { cell: Cell; rect: ReturnType<typeof cellRects>[number]; photos: Map<string, PhotoDTO>; resolveUrl: Props['resolveUrl'] }) {
  const photo = cell.photoId ? photos.get(cell.photoId) : undefined;
  if (!photo) return <View style={[styles.empty, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]} />;
  // Фото видно целиком, пока пользователь сам не выбрал «заполнить».
  const r = fitRect(photo, rect, cell.fit ?? 'contain');
  return (
    <View style={[styles.cell, { left: rect.x, top: rect.y, width: rect.width, height: rect.height }]}>
      <Image
        source={{ uri: resolveUrl(photo.url) }}
        style={{ position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height }}
        resizeMode="cover"
      />
    </View>
  );
}

/** Одна страница книги: белый лист с фото по шаблону. Без страницы (null) рисуется пустая подложка. */
export function PageView({ page, photos, resolveUrl, width, height }: Props) {
  const rects = page ? cellRects(page.template, width, height, page.cells.length) : [];
  return (
    <View style={[styles.sheet, { width, height }]}>
      {page?.cells.map((cell, i) => {
        const rect = rects[i];
        return rect ? <CellView key={i} cell={cell} rect={rect} photos={photos} resolveUrl={resolveUrl} /> : null;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: '#FFFFFF', overflow: 'hidden' },
  cell: { position: 'absolute', overflow: 'hidden', backgroundColor: '#FFFFFF' },
  empty: { position: 'absolute', backgroundColor: lightColors.border, opacity: 0.35 },
});
