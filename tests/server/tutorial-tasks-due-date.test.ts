import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import {
  signIn,
  DEFAULT_ADMIN_CREDENTIALS,
} from '@nocobase/app-plugin-authentication/testing';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { databaseManagerToken } from '@nocobase/db';
import { taskPermissions } from '../../server/providers/tutorial-tasks.js';
import { createStandaloneServer } from '../../server/standalone.js';

const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    app: { publicOrigin: 'http://localhost' },
    auth: { secret: 'due-date-test-secret-at-least-32-characters' },
    users: { initialAdmin: DEFAULT_ADMIN_CREDENTIALS },
    logging: { enabled: false },
  },
});
const headers = {
  'content-type': 'application/json',
  origin: 'http://localhost',
};

test('accepts old clients and calendar dates, and preserves dates when completing tasks', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const repo = testApp.application.container
    .resolve(databaseManagerToken)
    .repository('tutorialTasks');
  for (const input of [{}, { dueDate: null }, { dueDate: '2028-02-29' }]) {
    const response = await admin.fetch('/tutorialTasks', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Calendar task', ...input }),
    });
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as {
      data: { id: string; dueDate: string | null };
    };
    expect(data.dueDate).toBe(input.dueDate ?? null);
    expect(await repo.findOne({ filter: { id: data.id } })).toMatchObject({
      dueDate: input.dueDate ?? null,
    });
    for (const completed of [true, false]) {
      const updated = await admin.fetch(`/tutorialTasks/${data.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ completed }),
      });
      expect(updated.status).toBe(200);
      expect(await updated.json()).toMatchObject({
        data: { completed, dueDate: input.dueDate ?? null },
      });
    }
    const denied = await admin.fetch(`/tutorialTasks/${data.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ completed: true, dueDate: '2028-03-01' }),
    });
    expect(denied.status).toBe(400);
    expect(await repo.findOne({ filter: { id: data.id } })).toMatchObject({
      completed: false,
      dueDate: input.dueDate ?? null,
    });
  }
});

test('rejects invalid dates at the field boundary without writing records', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const repo = testApp.application.container
    .resolve(databaseManagerToken)
    .repository('tutorialTasks');
  const before = await repo.count();
  for (const dueDate of [
    '2027-02-29',
    '2026-02-30',
    '2026-13-01',
    '2026-1-2',
    '2026-10-24T00:00:00Z',
    '',
    123,
  ]) {
    const response = await admin.fetch('/tutorialTasks', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Invalid date', dueDate }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        fieldViolations: expect.arrayContaining([
          expect.objectContaining({ field: 'dueDate' }),
        ]),
      },
    });
  }
  expect(await repo.count()).toBe(before);
});

test('extends existing task read/create grants without granting writes to readers', async ({
  testApp,
}) => {
  const users = testApp.application.container.resolve(
    userAdministrationServiceToken,
  );
  const authz = testApp.application.container.resolve(authorizationToken);
  const credentials = {
    email: 'date-editor@example.test',
    password: 'date-test-password',
  };
  const person = await users.create({ name: 'Date editor', ...credentials });
  const editor = await signIn(testApp, credentials);
  expect((await editor.fetch('/tutorialTasks')).status).toBe(403);
  await authz.permissionSets.create({
    key: 'date-editor',
    grants: [
      taskPermissions.reference().grant({
        read: { tasks: 'allRecords' },
        create: { tasks: 'allRecords' },
      }),
    ],
  });
  await authz.permissionSets.assign({
    id: 'date-editor-user',
    permissionSet: 'date-editor',
    subject: { type: 'user', id: person.id },
  });
  const created = await editor.fetch('/tutorialTasks', {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Dated task', dueDate: '2026-12-31' }),
  });
  expect(created.status).toBe(201);
  const { data } = (await created.json()) as { data: { id: string } };
  expect(await (await editor.fetch('/tutorialTasks')).json()).toMatchObject({
    data: expect.arrayContaining([
      expect.objectContaining({ id: data.id, dueDate: '2026-12-31' }),
    ]),
  });
  await authz.permissionSets.delete('date-editor');
  await authz.permissionSets.create({
    key: 'date-reader',
    grants: [
      taskPermissions.reference().grant({ read: { tasks: 'allRecords' } }),
    ],
  });
  await authz.permissionSets.assign({
    id: 'date-reader-user',
    permissionSet: 'date-reader',
    subject: { type: 'user', id: person.id },
  });
  expect((await editor.fetch('/tutorialTasks')).status).toBe(200);
  expect(
    (
      await editor.fetch('/tutorialTasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: 'Forbidden', dueDate: '2026-12-31' }),
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await editor.fetch(`/tutorialTasks/${data.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ completed: true }),
      })
    ).status,
  ).toBe(403);
});
