import { defineMigration, type MigrationDefinition } from '@nocobase/db';
const migration: MigrationDefinition = defineMigration({
  name: '202610250001_activity_records',
  async up({ builder }) {
    await builder.createCollection('tutorialActivityRecords', (collection) => {
      collection.string('id', { primaryKey: true });
      collection.string('actorId', { nullable: false, length: 255 });
      collection.string('action', { nullable: false, length: 80 });
      collection.string('subject', { nullable: false, length: 255 });
      collection.string('summary', { nullable: false, length: 255 });
      collection.string('occurredAt', { nullable: false, length: 30 });
      collection.index(['occurredAt', 'id']);
    });
  },
  async down({ builder }) {
    await builder.dropCollection('tutorialActivityRecords');
  },
});
export default migration;
