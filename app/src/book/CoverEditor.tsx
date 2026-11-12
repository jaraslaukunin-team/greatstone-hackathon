import { HeaderEdge } from '../ui/HeaderEdge';
import type { BookTheme, Layout, PhotoDTO } from '@picpac/shared';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { setCover } from '../editor/editorActions';
import { lightColors, radius, space, typography } from '../theme/theme';
import { coverPage, coverTitle, SPINE_MIN_PAGES, spineAllowed } from './cover';
import { CoverView } from './CoverView';
import type { SourceOf } from './imageSource';

type Props = {
  layout: Layout;
  projectTitle: string;
  photos: PhotoDTO[];
  sourceOf: SourceOf;
  photoUpload?: React.ReactNode;
  theme: BookTheme;
  onChange(layout: Layout): void;
  onClose(): void;
};

const SPINE_W = 22;

/**
 * Редактор обложки: развёртка (задняя сторона, корешок, передняя), фото, название, подзаголовок и текст на корешке.
 * Текст на корешке доступен от 40 страниц: на тонкой книге он не поместится.
 */
export function CoverEditor({ layout, projectTitle, photos, sourceOf, photoUpload, theme, onChange, onClose }: Props) {
  const { width: winW } = useWindowDimensions();
  const cover = layout.cover;
  const canSpine = spineAllowed(layout.pages.length);
  const frontW = Math.min(220, Math.round((winW - space[4] * 2 - SPINE_W) / 2));
  const frontH = frontW;
  const patch = (p: Parameters<typeof setCover>[1]) => onChange(setCover(layout, p, projectTitle));

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.header}>
          <HeaderEdge inside />
          <Text style={styles.title}>Обложка</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Готово" onPress={onClose} style={styles.done}>
            <Text style={styles.doneText}>Готово</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.spread} accessibilityLabel="Развёртка обложки">
            <View style={[styles.back, { width: frontW, height: frontH, backgroundColor: cover?.color ?? theme.coverBg }]}>
              <Text style={[styles.backText, { color: theme.titleColor }]}>Задняя сторона</Text>
            </View>
            <View style={[styles.spineBar, { width: SPINE_W, height: frontH, backgroundColor: cover?.color ?? theme.coverBg }]}>
              {cover?.spine ? (
                <Text style={[styles.spineText, { color: theme.titleColor, width: frontH }]} numberOfLines={1}>
                  {cover.spine}
                </Text>
              ) : null}
            </View>
            <CoverView
              title={coverTitle(layout, projectTitle)}
              subtitle={cover?.subtitle}
              page={coverPage(layout)}
              sourceOf={sourceOf}
              theme={theme}
              color={cover?.color}
              width={frontW}
              height={frontH}
            />
          </View>

          <Text style={styles.label}>Фото обложки</Text>
          {photoUpload}
          <ScrollView horizontal contentContainerStyle={styles.strip} showsHorizontalScrollIndicator={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !cover?.photoId }}
              onPress={() => patch({ photoId: null })}
              style={[styles.noPhoto, !cover?.photoId && styles.thumbOn]}
            >
              <Text style={styles.noPhotoText}>Как на первой странице</Text>
            </Pressable>
            {photos.map((p) => {
              const info = sourceOf(p.id);
              return (
                <Pressable key={p.id} accessibilityRole="button" accessibilityLabel="Поставить это фото на обложку" onPress={() => patch({ photoId: p.id })}>
                  {info ? <Image source={info.source} style={[styles.thumb, cover?.photoId === p.id && styles.thumbOn]} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>Название</Text>
          <TextInput
            value={cover?.title ?? projectTitle}
            onChangeText={(title) => patch({ title })}
            maxLength={100}
            style={styles.input}
            accessibilityLabel="Название на обложке"
          />
          <Text style={styles.label}>Подзаголовок</Text>
          <TextInput
            value={cover?.subtitle ?? ''}
            onChangeText={(subtitle) => patch({ subtitle })}
            maxLength={100}
            placeholder="Например, лето 2026"
            placeholderTextColor={lightColors.textMuted}
            style={styles.input}
            accessibilityLabel="Подзаголовок обложки"
          />
          <Text style={styles.label}>Текст на корешке</Text>
          <TextInput
            value={cover?.spine ?? ''}
            onChangeText={(spine) => patch({ spine })}
            editable={canSpine}
            maxLength={60}
            style={[styles.input, !canSpine && styles.inputOff]}
            accessibilityLabel="Текст на корешке"
          />
          {!canSpine ? <Text style={styles.hint}>Текст на корешке — от {SPINE_MIN_PAGES} страниц: на тонкой книге он не поместится.</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: lightColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingTop: space[5], paddingBottom: space[2] },
  title: { ...typography.h1, color: lightColors.text },
  done: { minHeight: 44, paddingHorizontal: space[4], borderRadius: radius.button, backgroundColor: lightColors.accent, alignItems: 'center', justifyContent: 'center' },
  doneText: { ...typography.button, color: lightColors.textOnAccent },
  content: { padding: space[4], gap: space[2] },
  spread: { flexDirection: 'row', alignSelf: 'center', borderRadius: radius.photo, overflow: 'hidden', marginBottom: space[2] },
  back: { alignItems: 'center', justifyContent: 'center' },
  backText: { ...typography.caption, opacity: 0.7 },
  spineBar: { alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(0,0,0,0.25)', overflow: 'hidden' },
  spineText: { ...typography.label, textAlign: 'center', transform: [{ rotate: '90deg' }] },
  label: { ...typography.label, color: lightColors.textSecondary, marginTop: space[2] },
  strip: { gap: space[2], paddingVertical: space[1] },
  thumb: { width: 64, height: 64, borderRadius: radius.photo, backgroundColor: lightColors.border, borderWidth: 2, borderColor: 'transparent' },
  thumbOn: { borderColor: lightColors.accent },
  noPhoto: { width: 96, height: 64, borderRadius: radius.photo, borderWidth: 2, borderColor: lightColors.border, backgroundColor: lightColors.surface, alignItems: 'center', justifyContent: 'center', padding: 4 },
  noPhotoText: { ...typography.label, color: lightColors.text, textAlign: 'center' },
  input: { minHeight: 44, paddingHorizontal: space[3], borderRadius: radius.input, borderWidth: 1.5, borderColor: lightColors.borderStrong, backgroundColor: lightColors.surface, color: lightColors.text, ...typography.body },
  inputOff: { opacity: 0.45 },
  hint: { ...typography.caption, color: lightColors.textSecondary },
});
