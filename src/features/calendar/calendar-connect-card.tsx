import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import {
  CalendarPermissionContent,
  type CalendarPermissionContentProps,
} from '@/features/calendar/calendar-permission-content';
import { useTheme } from '@/hooks/use-theme';

/**
 * Inline card shown on the Today screen while the device calendar isn't
 * connected — the persistent re-entry point after the modal prompt is
 * dismissed. The OS permission prompt only fires from "Connect Calendar".
 */
export function CalendarConnectCard(props: Omit<CalendarPermissionContentProps, 'onDismiss'>) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <CalendarPermissionContent {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
