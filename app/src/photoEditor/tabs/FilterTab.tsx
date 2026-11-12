import { Canvas } from '@shopify/react-native-skia';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../../theme/theme';
import { EditScene } from '../EditScene';
import { initialState, type FilterId } from '../editState';
import { cropForAspect } from '../geometry';
import type { FilterTabProps } from './types';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'original', label: 'Оригинал' },
  { id: 'bw', label: 'Ч/Б' },
  { id: 'sepia', label: 'Сепия' },
  { id: 'warm', label: 'Тёплый' },
  { id: 'cool', label: 'Холодный' },
  { id: 'vintage', label: 'Винтаж' },
  { id: 'vivid', label: 'Яркий' },
  { id: 'soft', label: 'Мягкий' },
];
const THUMB = 72;
const CANVAS_STYLE = { width: THUMB, height: THUMB };

/** Готовые фильтры: у каждого миниатюра, нарисованная тем же Skia на самом фото. */
export function FilterTab({ state, srcW, srcH, image, dispatch }: FilterTabProps) {
  const crop = cropForAspect(srcW, srcH, 1);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {FILTERS.map((f) => {
        const selected = state.filterId === f.id;
        return (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Фильтр «${f.label}»`}
            onPress={() => dispatch({ type: 'commit', patch: { filterId: f.id } })}
            style={styles.item}
          >
            {/* Рамка на обёртке: Skia на вебе кладёт style холста прямо в DOM, массив стилей там падает. */}
            <View style={[styles.thumb, selected && styles.thumbOn]}>
              <Canvas style={CANVAS_STYLE}>
                <EditScene image={image} state={{ ...initialState(), crop, filterId: f.id }} width={THUMB} height={THUMB} typeface={null} />
              </Canvas>
            </View>
            <Text style={[styles.label, selected && styles.labelOn]}>{f.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: space[3], paddingVertical: space[1] },
  item: { width: THUMB, alignItems: 'center', gap: space[1] },
  thumb: { width: THUMB + 4, height: THUMB + 4, borderRadius: radius.photo * 2, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  thumbOn: { borderColor: lightColors.accent },
  label: { ...typography.caption, color: lightColors.textSecondary },
  labelOn: { color: lightColors.text },
});
