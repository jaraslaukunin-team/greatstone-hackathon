import { decorShapes, type DecorId } from '@picpac/shared';
import { useMemo } from 'react';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

type Props = {
  decor: DecorId;
  color: string;
  width: number;
  height: number;
};

/** Украшения темы по краям листа: рисуются под фото и не ловят касания. Без украшений ничего не выводит. */
export function ThemeDecor({ decor, color, width, height }: Props) {
  const shapes = useMemo(() => decorShapes(decor, width, height), [decor, width, height]);
  if (shapes.length === 0 || width <= 0 || height <= 0) return null;
  return (
    <Svg width={width} height={height} pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
      {shapes.map((s, i) => {
        switch (s.kind) {
          case 'rect':
            return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill={color} opacity={s.opacity} />;
          case 'circle':
            return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={color} opacity={s.opacity} />;
          case 'line':
            return (
              <Line
                key={i}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={color}
                strokeWidth={s.width}
                strokeDasharray={s.dash ? s.dash.join(',') : undefined}
                strokeLinecap="round"
                opacity={s.opacity}
              />
            );
          case 'frame':
            return (
              <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill="none" stroke={color} strokeWidth={s.width} opacity={s.opacity} />
            );
        }
      })}
    </Svg>
  );
}
