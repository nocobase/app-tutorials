export type TaskStatus = 'todo' | 'inProgress' | 'done';
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
export interface TaskList {
  data: Task[];
  meta: { page: number; pageSize: number; total: number };
}
export const statuses: TaskStatus[] = ['todo', 'inProgress', 'done'];
