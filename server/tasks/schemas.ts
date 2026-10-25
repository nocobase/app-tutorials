import { z } from 'zod';

export const taskStatus = z.enum(['todo', 'inProgress', 'done']);
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  });
export const taskDetails = z.strictObject({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(''),
  assigneeId: z.string().min(1).max(255).nullable().default(null),
  dueDate: calendarDate.nullable().default(null),
});
export const createTaskInput = taskDetails.extend({
  status: taskStatus.default('todo'),
});
export const editTaskInput = taskDetails.extend({
  expectedUpdatedAt: z.iso.datetime(),
});
export const progressInput = z.strictObject({
  status: taskStatus,
  expectedUpdatedAt: z.iso.datetime(),
});
export const deleteInput = z.object({ expectedUpdatedAt: z.iso.datetime() });
export const taskIdInput = z.object({ id: z.uuid() });
export const listTasksInput = z.object({
  q: z.string().trim().max(120).default(''),
  status: z.enum(['all', 'todo', 'inProgress', 'done']).default('all'),
  assignee: z.enum(['all', 'me']).default('all'),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['updatedAt', 'dueDate']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export const assigneeQuery = z.object({
  q: z.string().trim().max(120).default(''),
  page: z.coerce.number().int().min(1).max(1000000).default(1),
});
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: taskStatus,
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  permissions: z.object({
    edit: z.boolean(),
    progress: z.boolean(),
    delete: z.boolean(),
  }),
});
export type Task = z.infer<typeof taskSchema>;
export type TaskRow = Omit<
  Task,
  'assigneeName' | 'permissions' | 'createdAt' | 'updatedAt'
> & { createdAt: Date; updatedAt: Date };

export const taskRowSchema = taskSchema
  .omit({ assigneeName: true, permissions: true })
  .extend({ createdAt: z.coerce.date(), updatedAt: z.coerce.date() });
