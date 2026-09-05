import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { notifyTasksChanged } from '@/features/tasks/use-tasks';
import { isTaskOverdue } from '@/lib/taskBuckets';
import { setTaskStatus } from '@/services/tasks';
import type { Task } from '@/types/models';

const PRIORITY_LABEL: Record<Task['priority'], string> = {
  high: 'High priority',
  medium: '',
  low: '',
};

export function TaskListItem({ task }: { task: Task }) {
  const theme = useTheme();
  // Transient optimistic override so the checkbox flips instantly; cleared
  // once a real refetch confirms the server state via `task.status`. Reset
  // during render (not an effect) when the task prop itself changes — the
  // documented "adjust state when a prop changes" pattern.
  const [pending, setPending] = useState<boolean | null>(null);
  const [lastSeenStatus, setLastSeenStatus] = useState(task.status);
  const [toggling, setToggling] = useState(false);
  if (task.status !== lastSeenStatus) {
    setLastSeenStatus(task.status);
    setPending(null);
  }
  const completed = pending ?? task.status === 'completed';

  async function onToggle() {
    const next = completed ? 'todo' : 'completed';
    setPending(next === 'completed');
    setToggling(true);
    const res = await setTaskStatus(task.id, next);
    setToggling(false);
    if (res.error) {
      setPending(null);
      Alert.alert('Could not update task', res.error);
      return;
    }
    notifyTasksChanged();
  }

  const overdue = isTaskOverdue(task, new Date());

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Pressable
        onPress={onToggle}
        disabled={toggling}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: completed }}
        accessibilityLabel={completed ? 'Mark as not done' : 'Mark complete'}>
        <Ionicons
          name={completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={completed ? theme.success : theme.textTertiary}
        />
      </Pressable>

      <Link href={{ pathname: '/task/[id]/edit', params: { id: task.id } }} asChild>
        <Pressable style={styles.body}>
          <ThemedText
            type="default"
            numberOfLines={1}
            themeColor={completed ? 'textTertiary' : 'text'}
            style={completed ? styles.strikethrough : undefined}>
            {task.title}
          </ThemedText>
          {(task.dueDate || overdue || PRIORITY_LABEL[task.priority]) && !completed ? (
            <View style={styles.meta}>
              {task.dueDate ? (
                <ThemedText type="small" themeColor={overdue ? 'danger' : 'textSecondary'}>
                  {overdue ? 'Overdue' : formatDueDate(task.dueDate)}
                </ThemedText>
              ) : null}
              {PRIORITY_LABEL[task.priority] ? (
                <ThemedText type="small" themeColor="textTertiary">
                  {task.dueDate ? ' · ' : ''}
                  {PRIORITY_LABEL[task.priority]}
                </ThemedText>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Link>
    </View>
  );
}

function formatDueDate(dueDateIso: string): string {
  return new Date(dueDateIso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: 2, justifyContent: 'center' },
  meta: { flexDirection: 'row' },
  strikethrough: { textDecorationLine: 'line-through' },
});
