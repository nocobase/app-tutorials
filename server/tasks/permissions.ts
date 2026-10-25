import {
  defineCompositeResource,
  defineRecordAccess,
} from '@nocobase/authorization/core';
import { defineDatabasePermission } from '@nocobase/app-plugin-authorization/server';
import { buildFilter } from '@nocobase/repository-input';
import metadata from '../../package.json' with { type: 'json' };
import type { TaskRow } from './schemas.js';
export const label = (key: string) => ({
  ns: metadata.name,
  key: `tasks.${key}`,
});
const fields = [
  'id',
  'title',
  'description',
  'status',
  'assigneeId',
  'dueDate',
  'createdAt',
  'updatedAt',
] as const;
const data = defineDatabasePermission((p) =>
  p.collection<TaskRow>('tasks').title(label('title')).read(fields),
);
export const assignedTasks = defineRecordAccess('tasks.assigned', (access) =>
  access
    .title(label('assignedScope'))
    .collections('tasks')
    .resolver(({ principal }) =>
      principal.type === 'user'
        ? buildFilter((f) => f.string('assigneeId').eq(principal.id))
        : false,
    ),
);
export const taskPermissions = defineCompositeResource('tasks', (r) =>
  r
    .title(label('title'))
    .action('read', (a) =>
      a.title(label('readPermission')).grant('tasks', data),
    )
    .action('create', (a) =>
      a.title(label('createPermission')).grant('tasks', data.create(fields)),
    )
    .action('edit', (a) =>
      a
        .title(label('editPermission'))
        .grant(
          'tasks',
          data.update([
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
        .title(label('progressPermission'))
        .grant('tasks', data.update(['status', 'updatedAt'])),
    )
    .action('delete', (a) =>
      a.title(label('deletePermission')).grant('tasks', data.delete()),
    ),
);
export type TaskAction = 'read' | 'create' | 'edit' | 'progress' | 'delete';
