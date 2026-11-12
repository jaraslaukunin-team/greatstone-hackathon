import { router } from 'expo-router';
import { useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../src/theme/theme';

/** Движок Skia для браузера (~8 МБ): лежит в public/assets и раздаётся тем же сайтом. */
const CANVASKIT_URL = '/assets/canvaskit.wasm';

/**
 * Фоторедактор грузится лениво: на вебе сначала подгружается CanvasKit, и только потом код редактора,
 * которому он нужен при запуске. Остальное приложение Skia не касается. Если движок не загрузился,
 * показываем понятное сообщение, остальные экраны работают.
 */
export default function PhotoEditorRoute() {
  const [Editor, setEditor] = useState<ComponentType | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (Platform.OS === 'web') {
          const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
          await LoadSkiaWeb({ locateFile: () => CANVASKIT_URL });
        }
        const mod = await import('../src/photoEditor/EditorScreen');
        if (!cancelled) setEditor(() => mod.default);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (Editor) return <Editor />;
  return (
    <View style={styles.center}>
      {failed ? (
        <>
          <Text style={styles.text}>Редактор недоступен в этом браузере.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>Назад</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color={lightColors.accent} size="large" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: lightColors.bg, alignItems: 'center', justifyContent: 'center', gap: space[3], padding: space[4] },
  text: { ...typography.body, color: lightColors.text, textAlign: 'center' },
  back: { minHeight: 44, paddingHorizontal: space[4], borderRadius: radius.button, borderWidth: 1.5, borderColor: lightColors.borderStrong, backgroundColor: lightColors.surface, alignItems: 'center', justifyContent: 'center' },
  backText: { ...typography.bodyStrong, color: lightColors.text },
});
