import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CalendarPermissionStatus } from '@/services/calendar';

interface Props {
  status: CalendarPermissionStatus;
  canAskAgain: boolean;
  onConnect: () => Promise<void>;
  onOpenSettings: () => void;
}

/**
 * Shown on the Today screen while the device calendar isn't connected. The OS
 * permission prompt only fires from the "Connect Calendar" press — never on
 * mount.
 */
export function CalendarConnectCard({ status, canAskAgain, onConnect, onOpenSettings }: Props) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const blocked = status === 'denied' && !canAskAgain;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {blocked ? (
        <>
          <ThemedText type="smallBold">Calendar access is turned off</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Enable access in Settings to see your events in WassupDay.
          </ThemedText>
          <PrimaryButton label="Open Settings" variant="ghost" onPress={onOpenSettings} />
        </>
      ) : (
        <>
          <ThemedText type="smallBold">Connect your calendar</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            See your classes, meetings, and events in one place. WassupDay only reads your calendar —
            it will not change or delete your events.
          </ThemedText>
          <PrimaryButton
            label="Connect Calendar"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await onConnect();
              setBusy(false);
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
