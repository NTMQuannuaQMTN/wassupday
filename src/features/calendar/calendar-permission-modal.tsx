import { Modal, Pressable, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import {
  CalendarPermissionContent,
  type CalendarPermissionContentProps,
} from '@/features/calendar/calendar-permission-content';

type Props = Omit<CalendarPermissionContentProps, 'onDismiss'> & {
  visible: boolean;
  onClose: () => void;
};

/**
 * Centered popup asking to connect the device calendar. Shown once on entering
 * the Today screen while access isn't granted; dismissible ("Not now" / tap
 * outside) — the inline card remains as the re-entry point.
 */
export function CalendarPermissionModal({ visible, onClose, ...content }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        {/* Stop taps inside the card from closing the modal. */}
        <Pressable style={styles.cardWrap} onPress={() => {}}>
          <ThemedView style={styles.card}>
            <CalendarPermissionContent {...content} onDismiss={onClose} />
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  cardWrap: { width: '100%', maxWidth: 360 },
  card: {
    padding: Spacing.four,
    borderRadius: Radius.lg,
  },
});
