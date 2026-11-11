import Svg, { Path } from 'react-native-svg';
import { lightColors } from '../theme/theme';
import { iconPaths, type IconName } from './iconPaths';

/** Иконка из набора брендбука (Interface). По умолчанию 24×24, цвет текста. */
export function Icon({
  name,
  size = 24,
  color = lightColors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {iconPaths[name].map((p, i) => (
        <Path key={i} d={p.d} fill={color} fillRule={p.evenOdd ? 'evenodd' : 'nonzero'} />
      ))}
    </Svg>
  );
}

export type { IconName };
