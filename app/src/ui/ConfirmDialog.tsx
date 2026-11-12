import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';
import { Button } from './Button';

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Простой диалог подтверждения (удаление и т.п.). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Закрыть">
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Button title={cancelLabel} variant="secondary" onPress={onCancel} style={styles.btn} />
            <Button
              title={confirmLabel}
              variant={destructive ? 'primary' : 'dark'}
              onPress={onConfirm}
              style={styles.btn}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 36, 34, 0.45)',
    justifyContent: 'center',
    padding: space[5],
  },
  sheet: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.sheet,
    padding: space[5],
    gap: space[3],
  },
  title: { ...typography.h3, color: lightColors.text },
  message: { ...typography.body, color: lightColors.textSecondary },
  actions: { flexDirection: 'row', gap: space[3], marginTop: space[2] },
  btn: { flex: 1 },
});
