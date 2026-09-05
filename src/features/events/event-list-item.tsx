import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatClock } from '@/lib/time';
import type { CalendarEvent } from '@/types/models';

export function EventListItem({ event }: { event: CalendarEvent }) {
  const theme = useTheme();
  return (
    <Link href={{ pathname: '/event/[id]', params: { id: event.id } }} asChild>
      <Pressable
        style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.time}>
          <ThemedText type="smallBold">{formatClock(event.startTime)}</ThemedText>
          <ThemedText type="small" themeColor="textTertiary">
            {formatClock(event.endTime)}
          </ThemedText>
        </View>
        <View style={styles.body}>
          <ThemedText type="default" numberOfLines={1}>
            {event.title}
          </ThemedText>
          {event.location ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {event.location}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  time: { width: 64, gap: 2 },
  body: { flex: 1, gap: 2, justifyContent: 'center' },
});
