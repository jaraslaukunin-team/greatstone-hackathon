import { Stack } from 'expo-router';
import { stackOptions } from '../../src/ui/stackOptions';

export default function OrdersStackLayout() {
  return <Stack screenOptions={{ ...stackOptions, title: 'Заказ' }} />;
}
