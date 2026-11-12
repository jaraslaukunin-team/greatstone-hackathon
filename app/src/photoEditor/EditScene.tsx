import {
  ColorMatrix,
  Group,
  Image as SkiaImage,
  Path,
  Skia,
  Text as SkiaText,
  rect,
  type SkImage,
  type SkTypeface,
} from '@shopify/react-native-skia';
import { adjustMatrix, concatMatrix, filterMatrix } from './colorMatrix';
import type { EditState } from './editState';

type Props = {
  image: SkImage;
  state: EditState;
  /** Размер холста в пикселях: на экране это размер окна, при экспорте — размер файла. */
  width: number;
  height: number;
  /** Шрифт надписей (Futura PT); без него надписи не рисуются. */
  typeface: SkTypeface | null;
};

/**
 * Сцена редактора: фото с обрезкой, поворотом, отражением и цветом, поверх — надписи и штрихи.
 * Её рисуют и экран (Canvas), и экспорт (drawAsImage), поэтому на экране то же, что уйдёт в печать.
 * Надписи и штрихи заданы в долях кадра, поэтому не зависят от разрешения.
 */
export function EditScene({ image, state, width, height, typeface }: Props) {
  const srcW = image.width();
  const srcH = image.height();
  const cw = Math.max(1, state.crop.w * srcW);
  const ch = Math.max(1, state.crop.h * srcH);
  const cx = state.crop.x * srcW + cw / 2;
  const cy = state.crop.y * srcH + ch / 2;
  const quarter = state.rotation === 90 || state.rotation === 270;
  const scale = width / (quarter ? ch : cw);
  // Сначала настройки, затем фильтр.
  const matrix = concatMatrix(adjustMatrix(state.adjust), filterMatrix(state.filterId));

  return (
    <Group clip={rect(0, 0, width, height)}>
      {/* Порядок как в стилях RN: первое преобразование внешнее, поэтому читать снизу вверх. */}
      <Group
        transform={[
          { translateX: width / 2 },
          { translateY: height / 2 },
          { scale },
          { scaleX: state.flipX ? -1 : 1 },
          { rotate: (state.rotation * Math.PI) / 180 },
          { translateX: -cx },
          { translateY: -cy },
        ]}
      >
        <SkiaImage image={image} x={0} y={0} width={srcW} height={srcH}>
          <ColorMatrix matrix={matrix} />
        </SkiaImage>
      </Group>

      {state.strokes.map((stroke, i) => {
        const first = stroke.points[0];
        if (!first) return null;
        const builder = Skia.PathBuilder.Make();
        builder.moveTo(first[0] * width, first[1] * height);
        // Точка без движения превращается в короткую линию, иначе круглая кисть не нарисуется.
        if (stroke.points.length === 1) builder.lineTo(first[0] * width + 0.01, first[1] * height);
        for (const p of stroke.points.slice(1)) builder.lineTo(p[0] * width, p[1] * height);
        const path = builder.build();
        return (
          <Path key={`s${i}`} path={path} color={stroke.color} style="stroke" strokeWidth={stroke.width * width} strokeCap="round" strokeJoin="round" />
        );
      })}

      {typeface
        ? state.texts.map((t) => {
            const size = Math.max(1, t.size * height);
            const font = Skia.Font(typeface, size);
            const textWidth = font.measureText(t.text).width;
            return (
              <SkiaText key={t.id} text={t.text} font={font} color={t.color} x={t.x * width - textWidth / 2} y={t.y * height + size * 0.35} />
            );
          })
        : null}
    </Group>
  );
}
