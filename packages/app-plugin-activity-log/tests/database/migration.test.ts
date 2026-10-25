import { fileURLToPath } from 'node:url';

import { describeMigration } from '@nocobase/app-testing/server';

import metadata from '../../package.json' with { type: 'json' };

describeMigration('202610250001_activity_records', {
  sources: [
    {
      packageName: metadata.name,
      directory: fileURLToPath(
        new URL('../../database/migrations', import.meta.url),
      ),
    },
  ],
  up: async ({ expectCollection }) => {
    await expectCollection('tutorialActivityRecords').toHaveField('summary', {
      type: 'string',
      nullable: false,
      length: 255,
    });
  },
  down: async ({ expectCollection }) => {
    await expectCollection('tutorialActivityRecords').not.toExist();
  },
});
