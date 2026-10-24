import metadata from '../../package.json' with { type: 'json' };
import type { Application } from '@nocobase/app-server/application';
import { ServiceProvider } from '@nocobase/service-provider';
import { defineCompositeResource } from '@nocobase/authorization/core';
import {
  authorizationToken,
  defineDatabasePermission,
} from '@nocobase/app-plugin-authorization/server';

const taskData = defineDatabasePermission((p) =>
  p
    .collection('tutorialTasks')
    .read(['id', 'title', 'completed', 'updatedAt', 'assigneeId']),
);

export const taskPermissions = defineCompositeResource('tutorial.tasks', (r) =>
  r
    .title({ key: 'tasks.title', ns: metadata.name })
    .action('read', (a) =>
      a
        .title({ key: 'tasks.readPermission', ns: metadata.name })
        .grant('tasks', taskData),
    )
    .action('create', (a) =>
      a
        .title({ key: 'tasks.new', ns: metadata.name })
        .grant(
          'tasks',
          taskData.create([
            'id',
            'title',
            'completed',
            'updatedAt',
            'assigneeId',
          ]),
        ),
    )
    .action('update', (a) =>
      a
        .title({ key: 'tasks.updatePermission', ns: metadata.name })
        .grant('tasks', taskData.update(['completed', 'updatedAt'])),
    ),
);

export default class TutorialTasksProvider extends ServiceProvider<Application> {
  public readonly name = 'app/tutorial-tasks';

  public override async boot(): Promise<void> {
    const authz = this.app.container.resolve(authorizationToken);
    authz.database.collections.add({
      name: 'tutorialTasks',
      title: { key: 'tasks.title', ns: metadata.name },
    });
    const reference = authz.compositeResources.define(taskPermissions);
    authz.ui.sections.add({
      name: 'tutorial',
      title: { key: 'tasks.title', ns: metadata.name },
      parent: 'business',
    });
    authz.ui.place(reference, { section: 'tutorial' });
  }
}
