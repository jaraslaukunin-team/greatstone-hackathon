import { StyleSheet, View, type ViewProps } from 'react-native';
import { lightColors, radius, space } from '../theme/theme';

export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: lightColors.border,
    padding: space[4],
  },
});
