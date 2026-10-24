import { defineMigration } from '@nocobase/db';

export default defineMigration({
  name: '202610240003_add_task_due_date',
  async up({ builder }) {
    await builder.addField('tutorialTasks', {
      name: 'dueDate',
      type: 'string',
      length: 10,
      nullable: true,
    });
  },
  async down({ builder }) {
    await builder.dropField('tutorialTasks', 'dueDate');
  },
});
