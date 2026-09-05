import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { EventListItem } from '@/features/events/event-list-item';
import { TaskListItem } from '@/features/tasks/task-list-item';
import { useTodaySnapshot } from '@/features/today/use-today-snapshot';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, formatRelativeFuture } from '@/lib/time';
import type { ScheduleConflict, TodaySnapshot } from '@/types/models';

/**
 * Today — the product's home screen. Order matches the spec: greeting/date ->
 * NEXT -> TODAY timeline -> TASKS -> CONFLICTS.
 */
export default function TodayScreen() {
  const now = new Date();
  const { snapshot, events, loading, error, refetch } = useTodaySnapshot();

  const noTasks = snapshot.overdueTasks.length === 0 && snapshot.priorityTasks.length === 0;

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
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

          {loading && events.length === 0 ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : (
            <>
              <NextSection now={now} snapshot={snapshot} />

              <Section title="TODAY">
                {events.length === 0 ? (
                  <EmptyState title="Nothing scheduled today" hint="Add an event from the + tab." />
                ) : (
                  <View style={styles.list}>
                    {events.map((event) => (
                      <EventListItem key={event.id} event={event} />
                    ))}
                  </View>
                )}
              </Section>

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
