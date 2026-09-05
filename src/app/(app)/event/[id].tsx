import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useEvent } from '@/features/events/use-events';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, isSameLocalDay } from '@/lib/time';

const CATEGORY_LABELS: Record<string, string> = {
  class: 'Class',
  meeting: 'Meeting',
  personal: 'Personal',
  health: 'Health',
  social: 'Social',
  other: 'Other',
};

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event, loading, error, refetch } = useEvent(id);

  if (loading) return <LoadingState />;
  if (error || !event) {
    return <ErrorState message={error ?? 'Event not found.'} onRetry={refetch} />;
  }

  const sameDay = isSameLocalDay(event.startTime, event.endTime);
  const when = sameDay
    ? `${formatDay(event.startTime)} · ${formatClock(event.startTime)} – ${formatClock(event.endTime)}`
    : `${formatDay(event.startTime)} ${formatClock(event.startTime)} – ${formatDay(event.endTime)} ${formatClock(event.endTime)}`;

  return (
    <ThemedView style={styles.fill}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Link href={{ pathname: '/event/[id]/edit', params: { id: event.id } }}>
              <ThemedText type="smallBold" themeColor="accent">
                Edit
              </ThemedText>
            </Link>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle">{event.title}</ThemedText>

        <DetailRow icon="time-outline" text={when} />
        {event.location ? <DetailRow icon="location-outline" text={event.location} /> : null}
        <DetailRow
          icon="pricetag-outline"
          text={CATEGORY_LABELS[event.category] ?? event.category}
        />

        {event.description ? (
          <View style={styles.notes}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Notes
            </ThemedText>
            <ThemedText>{event.description}</ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function DetailRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={theme.textSecondary} />
      <ThemedText style={styles.detailText}>{text}</ThemedText>
    </View>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.three },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  detailText: { flex: 1 },
  notes: { gap: Spacing.one, marginTop: Spacing.two },
});
