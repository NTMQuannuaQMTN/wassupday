import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { CalendarPermissionStatus } from '@/services/calendar';
import type { CalendarUnavailableReason } from '@/features/calendar/use-device-calendar';

export interface CalendarPermissionContentProps {
  status: CalendarPermissionStatus;
  canAskAgain: boolean;
  unavailable: CalendarUnavailableReason | null;
  onConnect: () => Promise<void>;
  onOpenSettings: () => void;
  /** Provided when rendered in a dismissible modal; adds the secondary action. */
  onDismiss?: () => void;
}

type Mode = 'expo-go' | 'blocked' | 'ask';

function resolveMode({
  status,
  canAskAgain,
  unavailable,
}: Pick<CalendarPermissionContentProps, 'status' | 'canAskAgain' | 'unavailable'>): Mode {
  if (unavailable) return unavailable;
  if (status === 'denied' && !canAskAgain) return 'blocked';
  return 'ask';
}

const COPY: Record<Mode, { title: string; body: string }> = {
  ask: {
    title: 'Connect your calendar',
    body:
      'See your classes, meetings, and events in one place. WassupDay only reads your calendar — it will not change or delete your events.',
  },
  blocked: {
    title: 'Calendar access is turned off',
    body: 'Enable access in Settings to see your events in WassupDay.',
  },
  'expo-go': {
    title: 'Calendar needs a development build',
    body:
      "The device calendar can't be read in Expo Go. Run a development build (npx expo run:ios / run:android) to connect it.",
  },
};

/** Shared body for both the inline card and the modal prompt. */
export function CalendarPermissionContent({
  status,
  canAskAgain,
  unavailable,
  onConnect,
  onOpenSettings,
  onDismiss,
}: CalendarPermissionContentProps) {
  const [busy, setBusy] = useState(false);
  const mode = resolveMode({ status, canAskAgain, unavailable });
  const copy = COPY[mode];

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">{copy.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {copy.body}
      </ThemedText>

      {mode === 'ask' ? (
        <PrimaryButton
          label="Connect Calendar"
          loading={busy}
          onPress={async () => {
            setBusy(true);
            await onConnect();
            setBusy(false);
          }}
        />
      ) : null}
      {mode === 'blocked' ? (
        <PrimaryButton label="Open Settings" onPress={onOpenSettings} />
      ) : null}

      {onDismiss ? (
        <PrimaryButton
          label={mode === 'ask' || mode === 'blocked' ? 'Not now' : 'Got it'}
          variant="ghost"
          onPress={onDismiss}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.two },
});
