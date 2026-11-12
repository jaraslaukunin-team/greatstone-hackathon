import { ScrollView, StyleSheet, Text } from 'react-native';
import { OrderList } from '../../src/orders/OrderList';
import { lightColors, space, typography } from '../../src/theme/theme';

export default function OrdersScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Заказы</Text>
      <OrderList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: { padding: space[4], gap: space[3], paddingTop: space[7] },
  title: { ...typography.h1, color: lightColors.text },
});
