import Svg, { Path } from 'react-native-svg';
import { lightColors } from '../theme/theme';
import { logoAspect, logoPaths, logoViewBox } from './logoPaths';

/**
 * Фирменный логотип PicPac (SVG). Не вращать, не обводить, не добавлять тени (брендбук, стр. 6).
 * Цвет задаётся fill через `color`; высота — `height` (ширина по пропорции viewBox).
 */
export function Wordmark({
  color = lightColors.accent,
  height = 28,
  size,
}: {
  color?: string;
  height?: number;
  /** @deprecated используйте height */
  size?: number;
}) {
  const h = size ?? height;
  const w = Math.round(h * logoAspect);
  return (
    <Svg
      width={w}
      height={h}
      viewBox={logoViewBox}
      accessibilityRole="image"
      accessibilityLabel="Pic Pac"
    >
      {logoPaths.map((p, i) => (
        <Path key={i} d={p.d} fill={color} fillRule={p.evenOdd ? 'evenodd' : 'nonzero'} />
      ))}
    </Svg>
  );
}
