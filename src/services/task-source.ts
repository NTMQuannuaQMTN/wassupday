/**
 * The active task data source for the app.
 *
 * Currently the LOCAL DEMO source — realistic mock data with in-memory CRUD, so
 * the prototype runs fully offline in Expo Go. To use the real Supabase
 * backend instead, change the CRUD re-export below from
 * `@/services/demo/demo-tasks` to `@/services/tasks`. Every screen and hook
 * depends only on this module, never on a specific backend.
 */

// -- swap this line for a different backend --
export {
  createTask,
  deleteTask,
  getTask,
  listActiveTasks,
  listCompletedTasks,
  setTaskStatus,
  updateTask,
} from '@/services/demo/demo-tasks';

export { validateTaskInput } from '@/services/shared';
export type { ServiceResult, TaskInput } from '@/services/shared';
