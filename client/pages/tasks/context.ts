import { createContext, useContext, useEffect } from 'react';
import type { Task } from './types.js';
export const TasksContext = createContext<{
  changed: (task: Task, created?: boolean) => void;
  removed: (id: string, committed?: boolean) => void;
  reload: () => void;
  tasks: Task[];
  updates: Record<string, Task>;
  search: string;
  refreshVersion: number;
  missingIds: string[];
}>({
  changed: () => {},
  removed: () => {},
  reload: () => {},
  tasks: [],
  updates: {},
  search: '',
  refreshVersion: 0,
  missingIds: [],
});
export const useTasks = () => useContext(TasksContext);
export function focusTaskSearch() {
  requestAnimationFrame(() => document.getElementById('task-search')?.focus());
}

/** Route overlays can unmount through Escape, X, Back or an outside click. */
export function useTaskOverlayFocus() {
  useEffect(() => {
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return () => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const panel = document.querySelector<HTMLElement>(
            '[data-slot="route-overlay-content"]',
          );
          if (
            trigger?.isConnected &&
            trigger !== document.body &&
            (!panel || panel.contains(trigger))
          )
            trigger.focus();
          else if (panel) panel.focus();
          else document.getElementById('task-search')?.focus();
        }),
      );
    };
  }, []);
}
