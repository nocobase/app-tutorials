import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { describeMigration } from '@nocobase/app-testing/server';
import metadata from '../../package.json' with { type: 'json' };

describeMigration('202610240003_add_task_due_date', {
  sources: [
    {
      packageName: metadata.name,
      directory: fileURLToPath(
        new URL('../../database/main/migrations/', import.meta.url),
      ),
    },
  ],
  before: async ({ connection }) => {
    await connection.repository('tutorialTasks').createOne({
      values: {
        id: 'existing-task',
        title: 'Keep existing data',
        completed: true,
        assigneeId: 'existing-assignee',
        updatedAt: new Date('2026-10-24T00:00:00Z'),
      },
    });
  },
  up: async ({ expectCollection, connection }) => {
    await expectCollection('tutorialTasks').toHaveField('dueDate', {
      type: 'string',
      nullable: true,
    });
    expect(
      await connection
        .repository('tutorialTasks')
        .findOne({ filter: { id: 'existing-task' } }),
    ).toMatchObject({
      title: 'Keep existing data',
      completed: true,
      assigneeId: 'existing-assignee',
      dueDate: null,
    });
  },
  down: async ({ expectCollection, connection }) => {
    await expectCollection('tutorialTasks').not.toHaveField('dueDate');
    expect(
      await connection
        .repository('tutorialTasks')
        .findOne({ filter: { id: 'existing-task' } }),
    ).toMatchObject({
      title: 'Keep existing data',
      completed: true,
      assigneeId: 'existing-assignee',
    });
  },
});
