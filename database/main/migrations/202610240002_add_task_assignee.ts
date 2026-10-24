import { defineMigration } from '@nocobase/db';

export default defineMigration({
  name: '202610240002_add_task_assignee',
  async up({ builder }) {
    await builder.addField('tutorialTasks', {
      name: 'assigneeId', type: 'string', length: 255, nullable: true,
    });
  },
  async down({ builder }) {
    await builder.dropField('tutorialTasks', 'assigneeId');
  },
});
