import { defineMigration, type MigrationDefinition } from '@nocobase/db';

const migration: MigrationDefinition = defineMigration({
  name: '202610240001_create_tutorial_tasks',
  async up({ builder }) {
    await builder.createCollection('tutorialTasks', (collection) => {
      collection.string('id', { length: 36, primaryKey: true, nullable: false });
      collection.string('title', { length: 120, nullable: false });
      collection.boolean('completed', { nullable: false, defaultValue: false });
      collection.datetime('updatedAt', { nullable: false });
    });
  },
  async down({ builder }) {
    await builder.dropCollection('tutorialTasks');
  },
});

export default migration;
