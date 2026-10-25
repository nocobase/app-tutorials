import type { Application } from '@nocobase/app-server/application';
import { ServiceProvider } from '@nocobase/service-provider';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { assignedTasks, taskPermissions } from '../tasks/permissions.js';
import metadata from '../../package.json' with { type: 'json' };

export default class TasksProvider extends ServiceProvider<Application> {
  public readonly name = 'app/tasks';
  public override async boot(): Promise<void> {
    const authz = this.app.container.resolve(authorizationToken);
    authz.database.collections.add({
      name: 'tasks',
      title: { key: 'tasks.title', ns: metadata.name },
    });
    authz.recordAccess.define(assignedTasks);
    const reference = authz.compositeResources.define(taskPermissions);
    authz.ui.sections.add({
      name: 'tasks',
      title: { key: 'tasks.title', ns: metadata.name },
      parent: 'business',
    });
    authz.ui.place(reference, { section: 'tasks' });
  }
}
