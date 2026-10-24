export interface Task {
  id: string;
  title: string;
  completed: boolean;
  updatedAt: string;
}

export interface TasksContext {
  saved: (task: Task, created?: boolean) => void;
  focusHeading: () => void;
}
