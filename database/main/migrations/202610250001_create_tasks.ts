import { defineMigration } from '@nocobase/db';

export default defineMigration({
  name: '202610250001_create_tasks',
  async up({ builder }) {
    await builder.createCollection('tasks', (c) => {
      c.string('id', { length: 36, primaryKey: true, nullable: false });
      c.string('title', { length: 120, nullable: false });
      c.text('description', { nullable: false, defaultValue: '' });
      c.string('status', { length: 16, nullable: false, defaultValue: 'todo' });
      // User identity is owned by Authentication; resolve it through the Users public service.
      c.string('assigneeId', { length: 255, nullable: true });
      c.string('dueDate', { length: 10, nullable: true });
      c.datetime('createdAt', { nullable: false });
      c.datetime('updatedAt', { nullable: false });
      c.index(['assigneeId', 'status']);
      c.index('updatedAt');
      c.index('dueDate');
    });
  },
  async down({ builder }) { await builder.dropCollection('tasks'); },
});
