export interface Task {
  id: string;
  title: string;
  completed: boolean;
  updatedAt: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
}

export interface TasksContext {
  saved: (task: Task, created?: boolean) => void;
  focusHeading: () => void;
}
