import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function LoadingState() {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <ThemedText themeColor="textSecondary" style={styles.text}>
        {message}
      </ThemedText>
      {onRetry ? <PrimaryButton label="Try again" variant="ghost" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.center}>
      <ThemedText type="default">{title}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textTertiary" style={styles.text}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
  },
  text: { textAlign: 'center' },
});
