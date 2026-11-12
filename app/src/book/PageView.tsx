import { fitRect, type BookTheme, type Cell, type Page, type Rect } from '@picpac/shared';
import { Image, StyleSheet, View } from 'react-native';
import { lightColors } from '../theme/theme';
import { cellRects } from './cellRects';
import type { SourceOf } from './imageSource';

type Props = {
  page: Page | null;
  sourceOf: SourceOf;
  width: number;
  height: number;
  theme: BookTheme;
};

/** Поля рамки «полароид»: по бокам и сверху одинаковые, снизу шире. */
function innerRect(rect: Rect, frame: BookTheme['frame']): Rect {
  if (frame !== 'polaroid') return { x: 0, y: 0, width: rect.width, height: rect.height };
  const side = rect.width * 0.06;
  const bottom = rect.height * 0.16;
  return { x: side, y: side, width: rect.width - side * 2, height: rect.height - side - bottom };
}

function CellView({ cell, rect, sourceOf, theme }: { cell: Cell; rect: Rect; sourceOf: SourceOf; theme: BookTheme }) {
  const info = cell.photoId ? sourceOf(cell.photoId) : null;
  const box = { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
  if (!info) return <View style={[styles.empty, box]} />;

  const inner = innerRect(rect, theme.frame);
  // Фото видно целиком, пока пользователь сам не выбрал «заполнить».
  const fit = fitRect(info, inner, cell.fit ?? 'contain');
  // Кадр: масштаб растёт от центра, сдвиг задан долями размера ячейки.
  const scale = Math.max(1, cell.crop.scale);
  const w = fit.width * scale;
  const h = fit.height * scale;
  const left = fit.x + (fit.width - w) / 2 + cell.crop.x * inner.width;
  const top = fit.y + (fit.height - h) / 2 + cell.crop.y * inner.height;

  const frameStyle =
    theme.frame === 'thin'
      ? { borderWidth: 1, borderColor: theme.frameColor }
      : theme.frame === 'polaroid'
        ? { backgroundColor: theme.frameColor }
        : null;

  return (
    <View style={[styles.cell, frameStyle, box]}>
      <View style={{ position: 'absolute', left: inner.x, top: inner.y, width: inner.width, height: inner.height, overflow: 'hidden' }}>
        <Image source={info.source} style={{ position: 'absolute', left, top, width: w, height: h }} resizeMode="cover" />
      </View>
    </View>
  );
}

/** Одна страница книги: лист цвета темы с фото по шаблону. Без страницы (null) рисуется пустая подложка. */
export function PageView({ page, sourceOf, width, height, theme }: Props) {
  const rects = page ? cellRects(page.template, width, height, page.cells.length, theme) : [];
  return (
    <View style={[styles.sheet, { width, height, backgroundColor: theme.pageBg }]}>
      {page?.cells.map((cell, i) => {
        const rect = rects[i];
        return rect ? <CellView key={i} cell={cell} rect={rect} sourceOf={sourceOf} theme={theme} /> : null;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { overflow: 'hidden' },
  cell: { position: 'absolute', overflow: 'hidden' },
  empty: { position: 'absolute', backgroundColor: lightColors.border, opacity: 0.35 },
});
