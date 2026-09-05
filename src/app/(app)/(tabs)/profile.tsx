import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { signOut } from '@/services/auth';

export default function ProfileScreen() {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const displayName = (session?.user.user_metadata?.display_name as string | undefined) ?? null;

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{displayName ?? 'Your account'}</ThemedText>
            <ThemedText themeColor="textSecondary">{session?.user.email}</ThemedText>
          </View>

          <PrimaryButton
            label="Sign out"
            variant="ghost"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await signOut();
              setBusy(false);
            }}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { flex: 1, padding: Spacing.four, gap: Spacing.five },
  header: { gap: Spacing.one },
});
