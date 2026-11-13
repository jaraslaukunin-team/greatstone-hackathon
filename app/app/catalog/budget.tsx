import { ScrollView } from 'react-native';
import { BudgetPicker } from '../../src/catalog/BudgetPicker';
import { useCatalog } from '../../src/catalog/useCatalog';
import { ListSkeleton } from '../../src/ui/Skeleton';
import { StateBanner } from '../../src/ui/StateBanner';
import { space } from '../../src/theme/theme';

export default function BudgetScreen() {
  const catalog = useCatalog();
  if (catalog.isPending) return <ListSkeleton count={2} />;
  if (catalog.isError) return <StateBanner title="Не удалось загрузить каталог" actionLabel="Повторить" onAction={() => void catalog.refetch()} tone="danger" />;
  return <ScrollView contentContainerStyle={{ padding: space[4] }}><BudgetPicker products={catalog.data.products} /></ScrollView>;
}
