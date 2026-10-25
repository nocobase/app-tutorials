import { defineSeed } from '@nocobase/db';
import { encodeAuthorizationTitle } from '@nocobase/authorization/core';
import { taskRoles } from '../../seed-data/task-roles.ts';

export default defineSeed({
  name: '202610250002_task_roles',
  transaction: true,
  async run({ query }) {
    // Documented authorization persistence adapter; preserve administrator edits and assign no users implicitly.
    for (const role of taskRoles) {
      const existing = await query.selectFrom('authorizationPermissionSets').select('id').where('key', '=', role.key).executeTakeFirst();
      if (existing) continue;
      const now = new Date();
      await query.insertInto('authorizationPermissionSets').values({
        id: role.key, key: role.key, title: encodeAuthorizationTitle(role.title),
        grants: JSON.stringify(role.grants), createdAt: now, updatedAt: now,
      }).execute();
    }
  },
});
