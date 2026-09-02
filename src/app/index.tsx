import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/**
 * Placeholder home screen for the Phase 1 foundation.
 *
 * Phase 3 replaces this with an auth gate that routes to the sign-in screen or
 * the Today dashboard depending on the Supabase session.
 */
export default function IndexScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.block}>
          <ThemedText type="subtitle">wassupday</ThemedText>
          <ThemedText themeColor="textSecondary">
            Foundation ready. Auth, events, tasks and the Today dashboard land in the next phases.
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four },
  block: { gap: Spacing.two },
});
