import { StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';
import { Button } from './Button';

type Props = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'info' | 'warning' | 'danger';
};

export function StateBanner({
  title,
  message,
  actionLabel,
  onAction,
  tone = 'info',
}: Props) {
  const borderColor =
    tone === 'danger' ? lightColors.danger : tone === 'warning' ? lightColors.warning : lightColors.border;

  return (
    <View style={[styles.wrap, { borderColor }]}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="secondary" onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: lightColors.surfaceMuted,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[4],
    gap: space[2],
  },
  title: {
    ...typography.bodyStrong,
    color: lightColors.text,
  },
  message: {
    ...typography.caption,
    color: lightColors.textMuted,
  },
  button: {
    marginTop: space[1],
  },
});
