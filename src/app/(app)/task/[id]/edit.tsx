import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ErrorState, LoadingState } from '@/components/states';
import { ThemedView } from '@/components/themed-view';
import { TaskForm } from '@/features/tasks/task-form';
import { notifyTasksChanged, useTask } from '@/features/tasks/use-tasks';
import { deleteTask, setTaskStatus, updateTask } from '@/services/tasks';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { task, loading, error, refetch } = useTask(id);

  if (loading) return <LoadingState />;
  if (error || !task) {
    return <ErrorState message={error ?? 'Task not found.'} onRetry={refetch} />;
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <TaskForm
        submitLabel="Save changes"
        currentStatus={task.status}
        initial={{
          title: task.title,
          description: task.description,
          dueDate: task.dueDate,
          priority: task.priority,
          estimatedDuration: task.estimatedDuration,
        }}
        onSubmit={async (input) => {
          const res = await updateTask(task.id, input);
          if (res.error) return res.error;
          notifyTasksChanged();
          router.back();
          return null;
        }}
        onToggleStatus={async () => {
          const res = await setTaskStatus(task.id, task.status === 'todo' ? 'completed' : 'todo');
          if (res.error) return res.error;
          notifyTasksChanged();
          router.back();
          return null;
        }}
        onDelete={() =>
          new Promise<string | null>((resolve) => {
            Alert.alert('Delete task?', 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  const res = await deleteTask(task.id);
                  if (res.error) {
                    resolve(res.error);
                    return;
                  }
                  notifyTasksChanged();
                  resolve(null);
                  if (router.canDismiss()) router.dismissAll();
                  else router.replace('/(app)/(tabs)');
                },
              },
            ]);
          })
        }
      />
    </ThemedView>
  );
}
