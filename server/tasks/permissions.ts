import {
  defineCompositeResource,
  defineRecordAccess,
} from '@nocobase/authorization/core';
import { defineDatabasePermission } from '@nocobase/app-plugin-authorization/server';
import { buildFilter } from '@nocobase/repository-input';
import metadata from '../../package.json' with { type: 'json' };

export const taskActions = [
  'read',
  'create',
  'edit',
  'progress',
  'delete',
] as const;
export type TaskAction = (typeof taskActions)[number];
const title = (key: string) => ({ key: `tasks.${key}`, ns: metadata.name });
export const assignedTasks = defineRecordAccess('tasks.assigned', (a) =>
  a
    .title(title('assignedScope'))
    .collections('tasks')
    .resolver(({ principal }) =>
      principal.type === 'user'
        ? buildFilter((f) => f.string('assigneeId').eq(principal.id))
        : false,
    ),
);
const fields = [
  'id',
  'title',
  'description',
  'status',
  'assigneeId',
  'dueDate',
  'createdAt',
  'updatedAt',
];
const taskData = defineDatabasePermission((p) =>
  p.collection('tasks').read(fields),
);
export const taskPermissions = defineCompositeResource('tasks', (r) =>
  r
    .title(title('title'))
    .action('read', (a) => a.title(title('read')).grant('tasks', taskData))
    .action('create', (a) =>
      a
        .title(title('createPermission'))
        .grant('tasks', taskData.create(fields)),
    )
    .action('edit', (a) =>
      a
        .title(title('editPermission'))
        .grant(
          'tasks',
          taskData.update([
            'title',
            'description',
            'assigneeId',
            'dueDate',
            'updatedAt',
          ]),
        ),
    )
    .action('progress', (a) =>
      a
        .title(title('progressPermission'))
        .grant('tasks', taskData.update(['status', 'updatedAt'])),
    )
    .action('delete', (a) =>
      a.title(title('deletePermission')).grant('tasks', taskData.delete()),
    ),
);
