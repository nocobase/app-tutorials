export const TASK_STATUSES = ['todo', 'inProgress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  permissions: { edit: boolean; progress: boolean; delete: boolean };
}
export interface TasksContext {
  saved: (task: Task, created?: boolean) => void;
  missing: (id: string) => void;
  reload: () => void;
  focusList: () => void;
}
