import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { CalendarConnectCard } from '@/features/calendar/calendar-connect-card';
import { EventListItem } from '@/features/events/event-list-item';
import { TaskListItem } from '@/features/tasks/task-list-item';
import { useTodaySnapshot } from '@/features/today/use-today-snapshot';
import { useTheme } from '@/hooks/use-theme';
import { toDomainEvent } from '@/services/calendar';
import { formatClock, formatRelativeFuture, parseDateKey, toLocalDateKey } from '@/lib/time';
import type { DeviceCalendarEvent } from '@/services/calendar';
import type { ScheduleConflict, TodaySnapshot } from '@/types/models';

/**
 * Today — the product's home screen. Order: greeting/date -> (connect card) ->
 * NEXT -> TODAY timeline -> UPCOMING -> TASKS -> CONFLICTS.
 */
export default function TodayScreen() {
  const now = new Date();
  const { snapshot, events, loading, error, refetch, calendar } = useTodaySnapshot();

  const noTasks = snapshot.overdueTasks.length === 0 && snapshot.priorityTasks.length === 0;
  const upcomingSections = groupByDay(calendar.upcomingEvents);

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={calendar.isRefreshing} onRefresh={refetch} />
          }>
          <View style={styles.header}>
            <ThemedText type="small" themeColor="textSecondary">
              {now.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </ThemedText>
            <ThemedText type="title">{greeting(now)}</ThemedText>
          </View>

          {calendar.status !== 'granted' ? (
            <CalendarConnectCard
              status={calendar.status}
              canAskAgain={calendar.canAskAgain}
              onConnect={calendar.connect}
              onOpenSettings={calendar.openSettings}
            />
          ) : null}

          {loading && events.length === 0 ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : (
            <>
              <NextSection now={now} snapshot={snapshot} />

              <Section title="TODAY">
                {events.length === 0 ? (
                  <EmptyState title="Nothing scheduled today." hint="Enjoy the free space." />
                ) : (
                  <View style={styles.list}>
                    {events.map((event) => (
                      <EventListItem key={event.id} event={event} />
                    ))}
                  </View>
                )}
              </Section>

              {upcomingSections.length > 0 ? (
                <Section title="UPCOMING">
                  <View style={styles.list}>
                    {upcomingSections.map((s) => (
                      <View key={s.title} style={styles.list}>
                        <ThemedText type="small" themeColor="textTertiary">
                          {s.title}
                        </ThemedText>
                        {s.events.map((e) => (
                          <EventListItem key={e.id} event={toDomainEvent(e)} />
                        ))}
                      </View>
                    ))}
                  </View>
                </Section>
              ) : null}

              <Section title="TASKS">
                {noTasks ? (
                  <EmptyState title="Nothing urgent today" />
                ) : (
                  <View style={styles.list}>
                    {snapshot.overdueTasks.map((task) => (
                      <TaskListItem key={task.id} task={task} />
                    ))}
                    {snapshot.priorityTasks.map((task) => (
                      <TaskListItem key={task.id} task={task} />
                    ))}
                  </View>
                )}
              </Section>

              {snapshot.conflicts.length > 0 ? (
                <Section title="⚠ CONFLICTS">
                  <View style={styles.list}>
                    {snapshot.conflicts.map((conflict, i) => (
                      <ConflictRow key={i} conflict={conflict} />
                    ))}
                  </View>
                </Section>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Groups upcoming events into "Tomorrow" / weekday-labelled day buckets. */
function groupByDay(events: DeviceCalendarEvent[]): { title: string; events: DeviceCalendarEvent[] }[] {
  const todayKey = toLocalDateKey(new Date());
  const tomorrowKey = toLocalDateKey(new Date(Date.now() + 86_400_000));
  const buckets = new Map<string, DeviceCalendarEvent[]>();

  for (const event of events) {
    const key = toLocalDateKey(event.startDate);
    if (key === todayKey) continue; // "today" is covered by the TODAY section
    const list = buckets.get(key) ?? [];
    list.push(event);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayEvents]) => {
      const title =
        key === tomorrowKey
          ? 'Tomorrow'
          : parseDateKey(key).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            });
      return { title, events: dayEvents };
    });
}

function NextSection({ now, snapshot }: { now: Date; snapshot: TodaySnapshot }) {
  if (snapshot.currentEvent) {
    return (
      <Section title="NOW">
        <ThemedText type="smallBold">{formatClock(snapshot.currentEvent.startTime)}</ThemedText>
        <ThemedText type="subtitle">{snapshot.currentEvent.title}</ThemedText>
        <ThemedText themeColor="textSecondary">
          ends {formatRelativeFuture(now, snapshot.currentEvent.endTime)}
        </ThemedText>
      </Section>
    );
  }
  if (snapshot.nextEvent) {
    return (
      <Section title="NEXT">
        <ThemedText type="smallBold">{formatClock(snapshot.nextEvent.startTime)}</ThemedText>
        <ThemedText type="subtitle">{snapshot.nextEvent.title}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {formatRelativeFuture(now, snapshot.nextEvent.startTime)}
        </ThemedText>
      </Section>
    );
  }
  return (
    <Section title="NEXT">
      <EmptyState title="Nothing else today" />
    </Section>
  );
}

function ConflictRow({ conflict }: { conflict: ScheduleConflict }) {
  const theme = useTheme();
  const [earlier, later] =
    conflict.a.startTime <= conflict.b.startTime ? [conflict.a, conflict.b] : [conflict.b, conflict.a];
  return (
    <View
      style={[styles.conflictRow, { backgroundColor: theme.backgroundElement, borderColor: theme.danger }]}>
      <ThemedText type="small" themeColor="danger">
        {later.title} overlaps with {earlier.title}
      </ThemedText>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.five },
  header: { gap: Spacing.one },
  section: { gap: Spacing.two },
  list: { gap: Spacing.two },
  conflictRow: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
