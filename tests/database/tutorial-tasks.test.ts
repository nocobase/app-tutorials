import { fileURLToPath } from 'node:url';
import { describeMigration } from '@nocobase/app-testing/server';
import metadata from '../../package.json' with { type: 'json' };

describeMigration('202610240001_create_tutorial_tasks', {
  sources: [
    {
      packageName: metadata.name,
      directory: fileURLToPath(
        new URL('../../database/main/migrations/', import.meta.url),
      ),
    },
  ],
  up: async ({ expectCollection }) => {
    await expectCollection('tutorialTasks').toHaveField('id', {
      type: 'string',
      nullable: false,
    });
    await expectCollection('tutorialTasks').toHaveField('title', {
      type: 'string',
      nullable: false,
    });
    await expectCollection('tutorialTasks').toHaveField('completed', {
      type: 'boolean',
      nullable: false,
    });
  },
  down: async ({ expectCollection }) => {
    await expectCollection('tutorialTasks').not.toExist();
  },
});
