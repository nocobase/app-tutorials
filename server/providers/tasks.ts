import type { Application } from '@nocobase/app-server/application';
import {
  ServiceProvider,
  createServiceToken,
} from '@nocobase/service-provider';
import { databaseManagerToken } from '@nocobase/db';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { TaskService } from '../tasks/service.js';
import { taskPermissions, assignedTasks, label } from '../tasks/permissions.js';
export const taskServiceToken = createServiceToken<TaskService>(
  'quickstart-snapshot/tasks',
);
export default class TasksProvider extends ServiceProvider<Application> {
  readonly name = 'quickstart-snapshot/tasks';
  override async boot() {
    const authz = this.app.container.resolve(authorizationToken);
    authz.database.collections.add({ name: 'tasks', title: label('title') });
    authz.recordAccess.define(assignedTasks);
    authz.ui.sections.add({
      name: 'tasks',
      parent: 'business',
      title: label('title'),
    });
    authz.ui.place(authz.compositeResources.define(taskPermissions), {
      section: 'tasks',
    });
    this.app.container.instance(
      taskServiceToken,
      new TaskService(
        this.app.container.resolve(databaseManagerToken),
        this.app.container.resolve(userAdministrationServiceToken),
      ),
    );
  }
}
