import { StyleSheet, Text, View } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';
import { Button } from './Button';
import { Icon } from './Icon';

type Props = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'info' | 'warning' | 'danger';
};

const tones = {
  info: { backgroundColor: lightColors.fillSky, borderColor: lightColors.fillSky },
  warning: { backgroundColor: lightColors.fillSand, borderColor: lightColors.warning },
  danger: { backgroundColor: lightColors.fillRose, borderColor: lightColors.accent },
} as const;

export function StateBanner({
  title,
  message,
  actionLabel,
  onAction,
  tone = 'info',
}: Props) {
  return (
    <View style={[styles.wrap, tones[tone]]} accessibilityRole={tone === 'info' ? undefined : 'alert'}>
      <View style={styles.head}>
        <Icon
          name={tone === 'info' ? 'info' : 'alert'}
          size={24}
          color={tone === 'danger' ? lightColors.danger : tone === 'warning' ? lightColors.warning : lightColors.text}
        />
        <Text style={styles.title}>{title}</Text>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} variant="secondary" onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[4],
    gap: space[2],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  title: {
    flex: 1,
    ...typography.h3,
    color: lightColors.text,
  },
  message: {
    ...typography.caption,
    color: lightColors.textSecondary,
  },
  button: {
    marginTop: space[1],
  },
});
