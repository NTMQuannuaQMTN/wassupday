import { useCallback, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { EventListItem } from '@/features/events/event-list-item';
import { TaskListItem } from '@/features/tasks/task-list-item';
import { useTodaySnapshot } from '@/features/today/use-today-snapshot';
import { useTheme } from '@/hooks/use-theme';
import { formatClock, formatRelativeFuture, parseDateKey, toLocalDateKey } from '@/lib/time';
import type { CalendarEvent, ScheduleConflict, TodaySnapshot } from '@/types/models';

/**
 * Today — the product's home screen. Answers, in order:
 *   what day is it → what's happening now/next → today's schedule → what's
 *   coming → what needs doing → is anything clashing.
 */
export default function TodayScreen() {
  const now = new Date();
  const { session } = useAuth();
  const { snapshot, events, upcomingEvents, loading, error, refetch } = useTodaySnapshot();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refetch();
    setTimeout(() => setRefreshing(false), 400);
  }, [refetch]);

  const noTasks = snapshot.overdueTasks.length === 0 && snapshot.priorityTasks.length === 0;
  const upcomingSections = groupUpcoming(upcomingEvents);
  const firstName = displayName(session);

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.header}>
            <ThemedText type="small" themeColor="textSecondary">
              {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </ThemedText>
            <ThemedText type="title">{greeting(now, firstName)}</ThemedText>
          </View>

          {loading && events.length === 0 && noTasks ? (
            <ThemedText themeColor="textSecondary">Loading your day…</ThemedText>
          ) : error ? (
            <ErrorRow message={error} onRetry={refetch} />
          ) : (
            <>
              <NextCard now={now} snapshot={snapshot} />

              <Section title="TODAY">
                {events.length === 0 ? (
                  <EmptyRow title="Nothing scheduled today." hint="Enjoy the free space." />
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
                  <View style={styles.upcoming}>
                    {upcomingSections.map((s) => (
                      <View key={s.title} style={styles.list}>
                        <ThemedText type="small" themeColor="textTertiary">
                          {s.title}
                        </ThemedText>
                        {s.events.map((e) => (
                          <EventListItem key={e.id} event={e} />
                        ))}
                      </View>
                    ))}
                  </View>
                </Section>
              ) : null}

              <Section title="TASKS">
                {noTasks ? (
                  <EmptyRow title="Nothing needs attention right now." />
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
                <View style={styles.section}>
                  <ThemedText type="smallBold" themeColor="danger">
                    CONFLICTS
                  </ThemedText>
                  <View style={styles.list}>
                    {snapshot.conflicts.map((conflict) => (
                      <ConflictRow
                        key={`${conflict.a.id}-${conflict.b.id}`}
                        conflict={conflict}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function NextCard({ now, snapshot }: { now: Date; snapshot: TodaySnapshot }) {
  const theme = useTheme();
  const current = snapshot.currentEvent;
  const next = snapshot.nextEvent;

  let label: string;
  let event: CalendarEvent | null;
  let sub: string;

  if (current) {
    label = 'NOW';
    event = current;
    sub = `ends ${formatRelativeFuture(now, current.endTime)}`;
  } else if (next) {
    label = 'NEXT';
    event = next;
    sub = formatRelativeFuture(now, next.startTime);
  } else {
    label = 'NEXT';
    event = null;
    sub = '';
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      {event ? (
        <View style={[styles.nextCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText type="smallBold" themeColor="accent">
            {formatClock(event.startTime)} – {formatClock(event.endTime)}
          </ThemedText>
          <ThemedText type="subtitle" numberOfLines={2}>
            {event.title}
          </ThemedText>
          <View style={styles.nextMeta}>
            {event.location ? (
              <ThemedText type="small" themeColor="textSecondary">
                {event.location}
              </ThemedText>
            ) : null}
            {sub ? (
              <ThemedText type="small" themeColor="textSecondary">
                {event.location ? '  ·  ' : ''}
                {sub}
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : (
        <EmptyRow title="Nothing left on the schedule today." />
      )}
    </View>
  );
}

function ConflictRow({ conflict }: { conflict: ScheduleConflict }) {
  const theme = useTheme();
  const [earlier, later] =
    conflict.a.startTime <= conflict.b.startTime
      ? [conflict.a, conflict.b]
      : [conflict.b, conflict.a];
  return (
    <View
      style={[
        styles.conflictRow,
        { backgroundColor: theme.backgroundElement, borderColor: theme.danger },
      ]}>
      <ThemedText type="smallBold" themeColor="danger">
        {later.title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        overlaps {earlier.title} · {formatClock(conflict.overlapStart)}–
        {formatClock(conflict.overlapEnd)}
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

function EmptyRow({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={styles.emptyRow}>
      <ThemedText themeColor="textSecondary">{title}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textTertiary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

function ErrorRow({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.emptyRow}>
      <ThemedText themeColor="danger">{message}</ThemedText>
      <ThemedText type="smallBold" themeColor="accent" onPress={onRetry}>
        Try again
      </ThemedText>
    </View>
  );
}

/** Groups upcoming events into "Tomorrow" / weekday-labelled buckets, skipping today. */
function groupUpcoming(events: CalendarEvent[]): { title: string; events: CalendarEvent[] }[] {
  const todayKey = toLocalDateKey(new Date());
  const tomorrowKey = toLocalDateKey(new Date(Date.now() + 86_400_000));
  const buckets = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const key = toLocalDateKey(event.startTime);
    if (key === todayKey) continue;
    const list = buckets.get(key) ?? [];
    list.push(event);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayEvents]) => ({
      title:
        key === tomorrowKey
          ? 'Tomorrow'
          : parseDateKey(key).toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }),
      events: dayEvents,
    }));
}

function displayName(session: ReturnType<typeof useAuth>['session']): string | null {
  const name = session?.user.user_metadata?.display_name;
  return typeof name === 'string' && name.trim() ? name.trim().split(/\s+/)[0] : null;
}

function greeting(now: Date, name: string | null): string {
  const h = now.getHours();
  const base = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return name ? `${base}, ${name}.` : `${base}.`;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.five, paddingBottom: Spacing.six },
  header: { gap: Spacing.one },
  section: { gap: Spacing.two },
  list: { gap: Spacing.two },
  upcoming: { gap: Spacing.three },
  emptyRow: { gap: Spacing.half, paddingVertical: Spacing.two },
  nextCard: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nextMeta: { flexDirection: 'row', flexWrap: 'wrap' },
  conflictRow: {
    gap: 2,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
