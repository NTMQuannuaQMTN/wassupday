import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { TaskListItem } from '@/features/tasks/task-list-item';
import { useTaskSections } from '@/features/tasks/use-tasks';
import { useTheme } from '@/hooks/use-theme';
import type { Task } from '@/types/models';

export default function TasksScreen() {
  const theme = useTheme();
  const { today, upcoming, completed, loading, error, refetch } = useTaskSections();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const empty = today.length === 0 && upcoming.length === 0 && completed.length === 0;

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Tasks</ThemedText>
          <Pressable accessibilityLabel="New task" onPress={() => router.push('/task/new')} hitSlop={12}>
            <Ionicons name="add" size={28} color={theme.text} />
          </Pressable>
        </View>

        {loading && empty ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : empty ? (
          <EmptyState title="No tasks yet" hint="Tap + to add your first task." />
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Section title="TODAY" tasks={today} />
            <Section title="UPCOMING" tasks={upcoming} />
            <Section title="COMPLETED" tasks={completed} />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({ title, tasks }: { title: string; tasks: Task[] }) {
  if (tasks.length === 0) return null;
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
      <View style={styles.list}>
        {tasks.map((task) => (
          <TaskListItem key={task.id} task={task} />
        ))}
      </View>
    </View>
  );
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
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.six, gap: Spacing.five },
  section: { gap: Spacing.two },
  list: { gap: Spacing.two },
});
