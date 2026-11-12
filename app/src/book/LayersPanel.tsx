import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';
import type { SourceOf } from './imageSource';
import type { LayerInfo, LayerRef } from './layers';

type Props = {
  layers: LayerInfo[];
  selected: LayerRef | null;
  sourceOf: SourceOf;
  disabled?: boolean;
  onSelect(ref: LayerRef): void;
  onMove(ref: LayerRef, to: 'forward' | 'backward'): void;
  onToggleHidden(ref: LayerRef): void;
  onToggleLocked(ref: LayerRef): void;
  onRemove(ref: LayerRef): void;
  onClose(): void;
};

const same = (a: LayerRef | null, b: LayerRef) => !!a && a.kind === b.kind && a.pageIndex === b.pageIndex && a.index === b.index;

/** Панель слоёв: верхний слой впереди; для выбранного — порядок, «Скрыть», «Закрепить», «Удалить». Фон страницы закреплён. */
export function LayersPanel({ layers, selected, sourceOf, disabled, onSelect, onMove, onToggleHidden, onToggleLocked, onRemove, onClose }: Props) {
  const current = layers.find((l) => same(selected, l.ref));
  return (
    <View style={styles.panel}>
      <View style={styles.head}>
        <Text style={styles.title}>Слои</Text>
        <Text style={styles.hint}>{layers.length} объектов</Text>
      </View>
      <Text style={styles.hint}>Верхний слой впереди. Выберите строку и меняйте порядок кнопками.</Text>
      {layers.map((l) => {
        const info = l.photoId ? sourceOf(l.photoId) : null;
        const on = same(selected, l.ref);
        return (
          <Pressable
            key={`${l.ref.kind}-${l.ref.pageIndex}-${l.ref.index}`}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(l.ref)}
            style={[styles.row, on && styles.rowOn]}
          >
            {info ? <Image source={info.source} style={styles.thumb} resizeMode="cover" /> : <View style={[styles.thumb, styles.thumbText]}><Text style={styles.t}>T</Text></View>}
            <Text style={styles.name} numberOfLines={1}>
              {l.name}
            </Text>
            <Text style={styles.state}>{l.locked ? 'Закреплён' : l.hidden ? 'Скрыт' : 'Видно'}</Text>
          </Pressable>
        );
      })}
      <View style={styles.row}>
        <View style={[styles.thumb, styles.thumbBg]} />
        <Text style={styles.name}>Фон страницы</Text>
        <Text style={styles.state}>Закреплён</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={disabled || !current} onPress={() => current && onMove(current.ref, 'forward')} style={[styles.act, (disabled || !current) && styles.off]}>
          <Text style={styles.actText}>Выше</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={disabled || !current} onPress={() => current && onMove(current.ref, 'backward')} style={[styles.act, (disabled || !current) && styles.off]}>
          <Text style={styles.actText}>Ниже</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={disabled || !current} onPress={() => current && onToggleHidden(current.ref)} style={[styles.act, (disabled || !current) && styles.off]}>
          <Text style={styles.actText}>{current?.hidden ? 'Показать' : 'Скрыть'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={disabled || !current} onPress={() => current && onToggleLocked(current.ref)} style={[styles.act, (disabled || !current) && styles.off]}>
          <Text style={styles.actText}>{current?.locked ? 'Открепить' : 'Закрепить'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={disabled || !current || current.locked} onPress={() => current && onRemove(current.ref)} style={[styles.act, (disabled || !current || current?.locked) && styles.off]}>
          <Text style={[styles.actText, styles.danger]}>Удалить</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.close}>
        <Text style={styles.closeText}>Готово</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: lightColors.surface, borderRadius: radius.photo * 2, padding: space[3], gap: space[2] },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { ...typography.h2, color: lightColors.text },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 44, padding: 6, borderRadius: radius.photo, backgroundColor: lightColors.bg, borderWidth: 1.5, borderColor: 'transparent' },
  rowOn: { borderColor: lightColors.accent, backgroundColor: lightColors.fillRose },
  thumb: { width: 32, height: 32, borderRadius: 4, overflow: 'hidden', backgroundColor: lightColors.border },
  thumbText: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  thumbBg: { backgroundColor: lightColors.fillSand },
  t: { ...typography.bodyStrong, color: lightColors.text },
  name: { ...typography.bodyStrong, color: lightColors.text, flex: 1 },
  state: { ...typography.caption, color: lightColors.textSecondary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  act: { minHeight: 44, paddingHorizontal: space[3], borderRadius: radius.button, backgroundColor: lightColors.bg, alignItems: 'center', justifyContent: 'center' },
  actText: { ...typography.bodyStrong, color: lightColors.text },
  danger: { color: lightColors.danger },
  off: { opacity: 0.4 },
  close: { minHeight: 44, borderRadius: radius.button, backgroundColor: lightColors.accent, alignItems: 'center', justifyContent: 'center' },
  closeText: { ...typography.bodyStrong, color: '#FFFFFF' },
});
