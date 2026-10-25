// @vitest-environment node
import { fileURLToPath, URL } from 'node:url';
import { describeMigration } from '@nocobase/app-testing/server';
import metadata from '../../package.json' with { type: 'json' };

describeMigration('202610250001_create_tasks', {
  sources: [
    {
      packageName: metadata.name,
      directory: fileURLToPath(
        new URL('../../database/main/migrations/', import.meta.url),
      ),
    },
  ],
  up: async ({ expectCollection }) => {
    await expectCollection('tasks').toHaveField('id', {
      type: 'string',
      nullable: false,
    });
    await expectCollection('tasks').toHaveField('title', {
      type: 'string',
      nullable: false,
    });
    await expectCollection('tasks').toHaveField('status', {
      type: 'string',
      nullable: false,
    });
  },
  down: async ({ expectCollection }) => {
    await expectCollection('tasks').not.toExist();
  },
});
