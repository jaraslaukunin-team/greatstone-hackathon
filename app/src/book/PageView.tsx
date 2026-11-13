import { fitRect, type BookTheme, type Cell, type Page, type Rect } from '@picpac/shared';
import { Image, StyleSheet, Text, View } from 'react-native';
import { lightColors } from '../theme/theme';
import { cellRects } from './cellRects';
import { frameRect } from './layers';
import { QrCode } from './QrCode';
import type { SourceOf } from './imageSource';
import { fonts } from '../theme/theme';
import { TEXT_STYLES } from './textStyles';
import { TimelineCurve } from './TimelineCurve';
import { ThemeDecor } from './ThemeDecor';

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

function CellView({ cell, rect, sourceOf, theme, free }: { cell: Cell; rect: Rect; sourceOf: SourceOf; theme: BookTheme; free?: { rotate: number } }) {
  const info = cell.photoId ? sourceOf(cell.photoId) : null;
  const box = {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    ...(free && free.rotate ? { transform: [{ rotate: `${free.rotate}deg` }] } : null),
  };
  if (!info) return <View style={[styles.empty, box]} />;

  // Свободный слой: рамку рисует сам слой (border), а не тема.
  const inner = free ? { x: 0, y: 0, width: rect.width, height: rect.height } : innerRect(rect, theme.frame);
  // Фото видно целиком, пока пользователь сам не выбрал «заполнить».
  const fit = fitRect(info, inner, cell.fit ?? 'contain');
  // Кадр: масштаб растёт от центра, сдвиг задан долями размера ячейки.
  const scale = Math.max(1, cell.crop.scale);
  const w = fit.width * scale;
  const h = fit.height * scale;
  const left = fit.x + (fit.width - w) / 2 + cell.crop.x * inner.width;
  const top = fit.y + (fit.height - h) / 2 + cell.crop.y * inner.height;

  const frameStyle = free
    ? cell.border
      ? styles.photoBorder
      : null
    : theme.frame === 'thin'
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

/** Одна страница книги: лист (цвет темы или свой фон) с фото по шаблону и подписями. Без страницы (null) рисуется пустая подложка. */
export function PageView({ page, sourceOf, width, height, theme }: Props) {
  const rects = page ? cellRects(page.template, width, height, page.cells.length, theme, page.gap) : [];
  return (
    <View style={[styles.sheet, { width, height, backgroundColor: page?.bg ?? theme.pageBg }]}>
      <ThemeDecor decor={theme.decor} color={theme.decorColor} width={width} height={height} />
      {page?.timeline ? <TimelineCurve side={page.timeline} width={width} height={height} color={theme.textColor} stops={page.texts?.filter((text) => text.style === 'date').length ?? 0} /> : null}
      {page?.cells.map((cell, i) => {
        if (cell.hidden) return null;
        // Свободный слой рисуется в своей рамке, остальные ячейки — по шаблону.
        if (cell.frame) {
          const r = frameRect(cell.frame, width, height);
          return (
            <CellView
              key={i}
              cell={cell}
              rect={{ x: r.left, y: r.top, width: r.width, height: r.height }}
              sourceOf={sourceOf}
              theme={theme}
              free={{ rotate: r.rotate }}
            />
          );
        }
        const rect = rects[i];
        return rect ? <CellView key={i} cell={cell} rect={rect} sourceOf={sourceOf} theme={theme} /> : null;
      })}
      {page?.qr ? (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: (page.qr.x - page.qr.size / 2) * width, top: (page.qr.y - page.qr.size / 2) * height }}
        >
          <QrCode url={page.qr.url} size={page.qr.size * width} />
        </View>
      ) : null}
      {page?.texts?.map((t, i) => {
        const style = TEXT_STYLES[t.style];
        if (!style || t.hidden) return null;
        const size = style.size * width;
        const boxW = width * (page.timeline ? 0.46 : 0.8);
        // x, y — центр подписи: блок шире текста, поэтому центрируем его и сам текст.
        return (
          <Text
            key={`t${i}`}
            pointerEvents="none"
            numberOfLines={t.style === 'quote' ? 6 : 3}
            style={{
              position: 'absolute',
              left: Math.min(width - boxW, Math.max(0, t.x * width - boxW / 2)),
              top: Math.max(0, t.y * height - size * 0.7),
              width: boxW,
              textAlign: 'center',
              ...(t.rot ? { transform: [{ rotate: `${t.rot}deg` }] } : null),
              // Заголовок и подписи берут шрифт темы; дата и цитата остаются как заданы стилем.
              fontFamily: t.style === 'title' ? fonts[theme.titleFont] : t.style === 'caption' ? fonts[theme.captionFont] : style.font,
              fontSize: size,
              lineHeight: size * 1.25,
              color: theme.textColor,
            }}
          >
            {t.text}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { overflow: 'hidden' },
  cell: { position: 'absolute', overflow: 'hidden' },
  photoBorder: { borderWidth: 4, borderColor: '#FFFFFF', shadowColor: '#334033', shadowOpacity: 0.17, shadowRadius: 4, shadowOffset: { width: 1, height: 3 } },
  empty: { position: 'absolute', backgroundColor: lightColors.border, opacity: 0.35 },
});
