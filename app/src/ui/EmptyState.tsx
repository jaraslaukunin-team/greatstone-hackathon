import { StyleSheet, Text, View } from 'react-native';
import { lightColors, space, typography } from '../theme/theme';
import { Icon, type IconName } from './Icon';

/** Пустой экран: иконка в мятном круге, что произошло и что делать дальше. */
export function EmptyState({
  icon,
  title,
  message,
  children,
}: {
  icon: IconName;
  title: string;
  message?: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.circle}>
        <Icon name={icon} size={36} color={lightColors.text} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space[2], paddingVertical: space[6], paddingHorizontal: space[4] },
  circle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: lightColors.fillMint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  title: { ...typography.h2, color: lightColors.text, textAlign: 'center' },
  message: { ...typography.body, color: lightColors.textSecondary, textAlign: 'center' },
});
