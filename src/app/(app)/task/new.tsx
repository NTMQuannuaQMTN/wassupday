import { router } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { TaskForm } from '@/features/tasks/task-form';
import { notifyTasksChanged } from '@/features/tasks/use-tasks';
import { createTask } from '@/services/task-source';

export default function NewTaskScreen() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <TaskForm
        submitLabel="Add task"
        onSubmit={async (input) => {
          const res = await createTask(input);
          if (res.error) return res.error;
          notifyTasksChanged();
          router.back();
          return null;
        }}
      />
    </ThemedView>
  );
}
