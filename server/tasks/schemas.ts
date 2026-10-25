import { z } from 'zod';
export const taskStatus = z.enum(['todo', 'inProgress', 'done']);
export const taskDetails = z.strictObject({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(''),
  assigneeId: z.string().min(1).max(255).nullable().default(null),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(date.valueOf()) &&
        date.toISOString().slice(0, 10) === value
      );
    })
    .nullable()
    .default(null),
});
export const createTask = taskDetails.extend({
  status: taskStatus.default('todo'),
});
export const editTask = taskDetails.extend({
  expectedUpdatedAt: z.iso.datetime(),
});
export const progressTask = z.strictObject({
  status: taskStatus,
  expectedUpdatedAt: z.iso.datetime(),
});
export const taskId = z.object({ id: z.uuid() });
export const taskVersion = z.object({ expectedUpdatedAt: z.iso.datetime() });
export const listTasks = z.object({
  q: z.string().trim().max(120).default(''),
  status: taskStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z
    .enum(['updatedAt:desc', 'updatedAt:asc', 'dueDate:asc', 'dueDate:desc'])
    .default('updatedAt:desc'),
});
export const listAssignees = z.object({
  q: z.string().trim().max(120).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const rowSchema = taskDetails.extend({
  id: z.string(),
  status: taskStatus,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export const taskSchema = taskDetails.extend({
  id: z.string(),
  status: taskStatus,
  assigneeName: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  permissions: z.object({
    edit: z.boolean(),
    progress: z.boolean(),
    delete: z.boolean(),
  }),
});
export type TaskRow = z.infer<typeof rowSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskInput = z.infer<typeof createTask>;
export type TaskQuery = z.infer<typeof listTasks>;
