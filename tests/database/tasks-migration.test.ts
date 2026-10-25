import { fileURLToPath } from 'node:url';
import { describeMigration } from '@nocobase/app-testing/server';
import metadata from '../../package.json' with { type: 'json' };
describeMigration('202610250101_create_tasks', {
  sources: [
    {
      packageName: metadata.name,
      directory: fileURLToPath(
        new URL('../../database/main/migrations/', import.meta.url),
      ),
    },
  ],
  up: async ({ expectCollection }) => {
    await expectCollection('tasks').toHaveField('title', {
      type: 'string',
      nullable: false,
    });
    await expectCollection('tasks').toHaveField('assigneeId', {
      type: 'string',
      nullable: true,
    });
    await expectCollection('tasks').toHaveIndex(['assigneeId', 'status']);
    await expectCollection('tasks').toHaveIndex(['updatedAt']);
  },
  down: async ({ expectCollection }) => {
    await expectCollection('tasks').not.toExist();
  },
});
