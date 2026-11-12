import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Slider } from '../../ui/Slider';
import { lightColors, radius, space, typography } from '../../theme/theme';
import type { TextItem } from '../editState';
import { EDIT_COLORS } from '../palette';
import type { TabProps } from './types';

type Props = TabProps & { selectedId: string | null; onSelect(id: string | null): void };

/** Надписи: добавить, выбрать, поменять текст, размер и цвет, удалить. Двигать выбранную надпись — пальцем по фото. */
export function TextTab({ state, dispatch, selectedId, onSelect }: Props) {
  const [draft, setDraft] = useState('');
  const selected = state.texts.find((t) => t.id === selectedId) ?? null;

  function patch(id: string, p: Partial<TextItem>, kind: 'commit' | 'preview' = 'commit') {
    dispatch({ type: kind, patch: { texts: state.texts.map((t) => (t.id === id ? { ...t, ...p } : t)) } });
  }

  function add() {
    const text = draft.trim();
    if (!text) return;
    const item: TextItem = { id: `t${Date.now()}`, text, x: 0.5, y: 0.5, size: 0.08, color: '#FFFFFF' };
    dispatch({ type: 'commit', patch: { texts: [...state.texts, item] } });
    onSelect(item.id);
    setDraft('');
  }

  function remove(id: string) {
    dispatch({ type: 'commit', patch: { texts: state.texts.filter((t) => t.id !== id) } });
    onSelect(null);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="Новая надпись"
          placeholderTextColor={lightColors.textMuted}
          maxLength={60}
          style={styles.input}
          accessibilityLabel="Текст новой надписи"
        />
        <Pressable accessibilityRole="button" onPress={add} disabled={!draft.trim()} style={[styles.add, !draft.trim() && styles.off]}>
          <Text style={styles.addText}>Добавить</Text>
        </Pressable>
      </View>

      {state.texts.length > 0 ? (
        <View style={styles.row}>
          {state.texts.map((t) => (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityState={{ selected: t.id === selectedId }}
              onPress={() => onSelect(t.id)}
              style={[styles.chip, t.id === selectedId && styles.chipOn]}
            >
              <Text style={[styles.chipText, t.id === selectedId && styles.chipTextOn]} numberOfLines={1}>
                {t.text}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>Добавьте надпись, затем двигайте её пальцем по фото.</Text>
      )}

      {selected ? (
        <>
          <TextInput
            key={selected.id}
            defaultValue={selected.text}
            onEndEditing={(e) => {
              const text = e.nativeEvent.text.trim();
              if (text && text !== selected.text) patch(selected.id, { text });
            }}
            maxLength={60}
            style={styles.input}
            accessibilityLabel="Текст надписи"
          />
          <Slider
            label="Размер"
            value={Math.round(selected.size * 100)}
            min={3}
            max={20}
            step={1}
            format={(v) => `${v}%`}
            onChange={(v) => patch(selected.id, { size: v / 100 }, 'preview')}
            onCommit={(v) => patch(selected.id, { size: v / 100 })}
          />
          <View style={styles.row}>
            {EDIT_COLORS.map((c) => (
              <Pressable
                key={c}
                accessibilityRole="button"
                accessibilityLabel={`Цвет ${c}`}
                accessibilityState={{ selected: selected.color === c }}
                onPress={() => patch(selected.id, { color: c })}
                style={[styles.swatch, { backgroundColor: c }, selected.color === c && styles.swatchOn]}
              />
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={() => remove(selected.id)} style={styles.remove}>
            <Text style={styles.removeText}>Удалить надпись</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[3] },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  input: { flex: 1, minHeight: 44, minWidth: 140, paddingHorizontal: space[3], borderRadius: radius.input, borderWidth: 1.5, borderColor: lightColors.borderStrong, backgroundColor: lightColors.surface, color: lightColors.text, ...typography.body },
  add: { minHeight: 44, paddingHorizontal: space[4], borderRadius: radius.button, backgroundColor: lightColors.accent, alignItems: 'center', justifyContent: 'center' },
  addText: { ...typography.button, color: lightColors.textOnAccent },
  off: { opacity: 0.4 },
  chip: { minHeight: 44, maxWidth: 160, paddingHorizontal: space[3], borderRadius: radius.button, borderWidth: 1.5, borderColor: lightColors.borderStrong, backgroundColor: lightColors.surface, justifyContent: 'center' },
  chipOn: { backgroundColor: lightColors.action, borderColor: lightColors.action },
  chipText: { ...typography.bodyStrong, color: lightColors.text },
  chipTextOn: { color: '#FFFFFF' },
  hint: { ...typography.caption, color: lightColors.textSecondary },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: lightColors.borderStrong },
  swatchOn: { borderColor: lightColors.accent, borderWidth: 3 },
  remove: { minHeight: 44, borderRadius: radius.button, borderWidth: 1.5, borderColor: lightColors.danger, alignItems: 'center', justifyContent: 'center' },
  removeText: { ...typography.bodyStrong, color: lightColors.danger },
});
