import type { BookTheme, Page } from '@picpac/shared';
import { StyleSheet, Text, View } from 'react-native';
import { fonts, lightColors, space, typography } from '../theme/theme';
import type { SourceOf } from './imageSource';
import { PageView } from './PageView';

type Props = {
  title: string;
  subtitle?: string;
  /** Страница с фото обложки (coverPage); null — обложка без фото. */
  page: Page | null;
  sourceOf: SourceOf;
  theme: BookTheme;
  /** Цвет ткани обложки (Cover.color); без него берётся цвет темы. */
  color?: string;
  width: number;
  height: number;
};

/** Передняя сторона обложки в стиле темы: фото на весь лист, фото в рамке или цветная с названием. */
export function CoverView({ title, subtitle, page, sourceOf, theme, color, width, height }: Props) {
  const titleStyle = { fontFamily: fonts[theme.titleFont], color: theme.titleColor };
  return (
    <View style={[styles.cover, { width, height, backgroundColor: color ?? theme.coverBg }]}>
      {theme.cover === 'full-photo' && page ? (
        <PageView page={page} sourceOf={sourceOf} width={width} height={height} theme={theme} />
      ) : null}
      {theme.cover === 'framed-photo' && page ? (
        <View style={{ position: 'absolute', left: width * 0.1, top: height * 0.08, width: width * 0.8, height: height * 0.68 }}>
          <PageView page={page} sourceOf={sourceOf} width={width * 0.8} height={height * 0.68} theme={theme} />
        </View>
      ) : null}
      <View
        style={[styles.titleBox, theme.cover === 'full-photo' ? styles.shade : null, theme.cover === 'color-title' ? styles.titleCenter : null]}
        pointerEvents="none"
      >
        <Text style={[styles.title, titleStyle]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, titleStyle]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden', justifyContent: 'flex-end' },
  titleBox: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: space[3], gap: 2 },
  shade: { backgroundColor: 'rgba(0,0,0,0.45)' },
  titleCenter: { top: 0, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.h2 },
  subtitle: { ...typography.caption, opacity: 0.85, color: lightColors.surface },
});
