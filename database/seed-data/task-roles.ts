import { definePermissionSet } from '@nocobase/authorization/permission-sets';
import { taskPermissions } from '../../server/tasks/permissions.ts';
import metadata from '../../package.json' with { type: 'json' };

const role = (key: string, title: string) =>
  definePermissionSet(key)
    .title({ key: `tasks.${title}`, ns: metadata.name })
    .grant({
      resource: { type: 'page', id: 'tasks' },
      actions: [{ action: 'access' }],
    });
export const taskRoles = [
  role('task-manager', 'manager')
    .grant(
      taskPermissions.reference().grant({
        read: { tasks: 'allRecords' },
        create: { tasks: 'allRecords' },
        edit: { tasks: 'allRecords' },
        progress: { tasks: 'allRecords' },
        delete: { tasks: 'allRecords' },
      }),
    )
    .build(),
  role('task-member', 'member')
    .grant(
      taskPermissions.reference().grant({
        read: { tasks: 'tasks.assigned' },
        progress: { tasks: 'tasks.assigned' },
      }),
    )
    .build(),
  role('task-reader', 'reader')
    .grant(taskPermissions.reference().grant({ read: { tasks: 'allRecords' } }))
    .build(),
];
