import type { ProjectDTO } from '@picpac/shared';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { lightColors, radius, space, typography } from '../theme/theme';
import { Icon } from '../ui/Icon';

export type ProjectMenuAction = 'open' | 'duplicate' | 'rename' | 'share' | 'delete';

type Props = {
  visible: boolean;
  project: ProjectDTO | null;
  onClose: () => void;
  onAction: (action: ProjectMenuAction) => void;
};

type Item = {
  action: ProjectMenuAction;
  title: string;
  icon: 'folder' | 'doc' | 'pencil' | 'share' | 'trash';
  danger?: boolean;
};

/** Меню действий над проектом в «Мои дизайны». */
export function ProjectMenu({ visible, project, onClose, onAction }: Props) {
  if (!project) return null;

  const items: Item[] = [
    { action: 'open', title: 'Открыть', icon: 'folder' },
    { action: 'duplicate', title: 'Дублировать', icon: 'doc' },
    { action: 'rename', title: 'Переименовать', icon: 'pencil' },
  ];
  if (project.isShared) {
    items.push({ action: 'share', title: 'Поделиться ссылкой', icon: 'share' });
  }
  items.push({ action: 'delete', title: 'Удалить', icon: 'trash', danger: true });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть меню">
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{project.title}</Text>
          {items.map((item) => (
            <Pressable
              key={item.action}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => onAction(item.action)}
              accessibilityRole="button"
            >
              <Icon name={item.icon} size={22} color={item.danger ? lightColors.danger : lightColors.text} />
              <Text style={[styles.rowText, item.danger && styles.danger]}>{item.title}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 36, 34, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: lightColors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space[4],
    paddingBottom: space[7],
    gap: space[1],
  },
  title: { ...typography.h3, color: lightColors.text, marginBottom: space[2], paddingHorizontal: space[2] },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[2],
    borderRadius: radius.button,
  },
  rowPressed: { backgroundColor: lightColors.fillSand },
  rowText: { ...typography.body, color: lightColors.text },
  danger: { color: lightColors.danger },
});
