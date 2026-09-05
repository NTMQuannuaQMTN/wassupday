import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { EventListItem } from '@/features/events/event-list-item';
import { useUpcomingEvents } from '@/features/events/use-events';
import { useTheme } from '@/hooks/use-theme';
import { parseDateKey, toLocalDateKey } from '@/lib/time';
import type { CalendarEvent } from '@/types/models';

export default function CalendarScreen() {
  const theme = useTheme();
  const { events, loading, error, refetch } = useUpcomingEvents(21);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const sections = useMemo(() => groupByDay(events), [events]);

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Calendar</ThemedText>
          <Pressable
            accessibilityLabel="New event"
            onPress={() => router.push('/event/new')}
            hitSlop={12}>
            <Ionicons name="add" size={28} color={theme.text} />
          </Pressable>
        </View>

        {loading && events.length === 0 ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : sections.length === 0 ? (
          <EmptyState title="Nothing scheduled" hint="Tap + to add your first event." />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
                {section.title}
              </ThemedText>
            )}
            renderItem={({ item }) => <EventListItem event={item} />}
            ItemSeparatorComponent={() => <View style={styles.gap} />}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function groupByDay(events: CalendarEvent[]): { title: string; data: CalendarEvent[] }[] {
  const todayKey = toLocalDateKey(new Date());
  const tomorrowKey = toLocalDateKey(new Date(Date.now() + 86_400_000));
  const buckets = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const key = toLocalDateKey(event.startTime);
    const list = buckets.get(key) ?? [];
    list.push(event);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      let title = parseDateKey(key).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      if (key === todayKey) title = 'Today';
      else if (key === tomorrowKey) title = 'Tomorrow';
      return { title, data };
    });
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six },
  sectionHeader: { marginTop: Spacing.four, marginBottom: Spacing.two },
  gap: { height: Spacing.two },
});
