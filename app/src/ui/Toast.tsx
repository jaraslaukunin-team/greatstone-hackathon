import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';

type ToastState = { message: string; id: number } | null;

let pushToast: ((message: string) => void) | null = null;
let seq = 0;

/** Показать короткое сообщение поверх экрана (веб и запасной канал уведомлений). */
export function showToast(message: string): void {
  pushToast?.(message);
}

/** Хост тостов — один раз в корне или на экране, где нужны уведомления. */
export function ToastHost() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    pushToast = (message) => setToast({ message, id: ++seq });
    return () => {
      pushToast = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;

  return (
    <View pointerEvents="none" style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.bubble}>
        <Text style={styles.text}>{toast.message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space[4],
    right: space[4],
    bottom: space[7],
    alignItems: 'center',
    zIndex: 1000,
  },
  bubble: {
    backgroundColor: lightColors.action,
    borderRadius: radius.button,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    maxWidth: 420,
  },
  text: { ...typography.body, color: '#FFFFFF', textAlign: 'center' },
});
