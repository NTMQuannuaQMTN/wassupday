import { router } from 'expo-router';
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

          {__DEV__ ? (
            // Dev-only: the real forgot-password flow needs the live
            // project's Supabase auth redirect allow-list pushed (not done
            // yet — see PROGRESS.md), so a real emailed link can't be tested
            // end-to-end. This exercises the same update-password write path
            // against the *current, real* session, so "does resetting a
            // password actually persist" can be verified against the live
            // database without waiting on that. `__DEV__` is `false` in
            // release builds, so this is unreachable in production.
            <PrimaryButton
              label="Dev: test password reset screen"
              variant="ghost"
              onPress={() => router.push('/reset-password?dev=1')}
            />
          ) : null}
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
