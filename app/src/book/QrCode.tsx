import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { qrMatrix } from './qrMatrix';

const QUIET = 4; // тихая зона по краям, в модулях

type Props = { url: string; size: number };

/** QR-код векторным SVG: один путь на все тёмные модули, белая подложка и тихая зона. Небезопасная ссылка не рисуется. */
export function QrCode({ url, size }: Props) {
  const matrix = useMemo(() => qrMatrix(url), [url]);
  const d = useMemo(() => {
    if (!matrix) return '';
    let path = '';
    matrix.forEach((row, r) => {
      let c = 0;
      while (c < row.length) {
        if (!row[c]) {
          c++;
          continue;
        }
        // Подряд идущие тёмные модули сливаем в один прямоугольник.
        let end = c;
        while (end < row.length && row[end]) end++;
        path += `M${c + QUIET} ${r + QUIET}h${end - c}v1h${-(end - c)}z`;
        c = end;
      }
    });
    return path;
  }, [matrix]);
  if (!matrix) return null;
  const total = matrix.length + QUIET * 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`} accessibilityLabel="QR-код на видео">
      <Rect x={0} y={0} width={total} height={total} fill="#FFFFFF" />
      <Path d={d} fill="#000000" />
    </Svg>
  );
}
