import { timelineAnchors, timelineCurves, type TimelineSide } from '@picpac/shared';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

export function TimelineCurve({ side, width, height, color, stops }: { side: TimelineSide; width: number; height: number; color: string; stops: number }) {
  const { start, first, second, end } = timelineCurves[side];
  return (
    <Svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
      <Path d={`M ${start.map((x) => x * 100).join(' ')} C ${[...first, ...second, ...end].map((x) => x * 100).join(' ')}`}
        fill="none" stroke={color} strokeWidth={1.2} />
      {timelineAnchors(side).slice(0, stops).map(([x, y], index) => (
        <G key={index}>
          <Line x1={x! * 100} y1={y! * 100} x2={x! * 100} y2={index === 0 ? 44 : 65} stroke={color} strokeWidth={0.6} />
          <Circle cx={x! * 100} cy={y! * 100} r={1.6} fill={color} />
        </G>
      ))}
    </Svg>
  );
}
