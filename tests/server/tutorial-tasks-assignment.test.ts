import { randomUUID } from 'node:crypto';
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
    auth: { secret: 'assignment-test-secret-at-least-32-characters' },
    users: { initialAdmin: DEFAULT_ADMIN_CREDENTIALS },
    logging: { enabled: false },
  },
});
const headers = {
  'content-type': 'application/json',
  origin: 'http://localhost',
};

test('protects the assignee directory and exposes only names and IDs', async ({
  testApp,
  request,
}) => {
  expect((await request('/tutorialTasks/assignees')).status).toBe(401);
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const users = testApp.application.container.resolve(
    userAdministrationServiceToken,
  );
  const disabled = await users.create({
    name: 'Disabled candidate',
    email: 'disabled-candidate@example.test',
    password: 'assignment-test-password',
  });
  await users.disable(disabled.id);
  const response = await admin.fetch('/tutorialTasks/assignees');
  expect(response.status).toBe(200);
  const { data } = (await response.json()) as {
    data: { id: string; name: string }[];
  };
  expect(data.length).toBeGreaterThan(0);
  expect(
    data.every((user) => Object.keys(user).sort().join(',') === 'id,name'),
  ).toBe(true);
  expect(data.some((user) => user.id === disabled.id)).toBe(false);
});

test('persists a real assignee, resolves current names and keeps unassigned tasks valid', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const users = testApp.application.container.resolve(
    userAdministrationServiceToken,
  );
  const person = await users.create({
    name: 'Assignee before rename',
    email: 'assignee-person@example.test',
    password: 'assignment-test-password',
  });
  for (const assigneeId of [person.id, null]) {
    const response = await admin.fetch('/tutorialTasks', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Assigned task', assigneeId }),
    });
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: { id: string } };
    const db = testApp.application.container.resolve(databaseManagerToken);
    expect(
      await db.repository('tutorialTasks').findOne({ filter: { id: data.id } }),
    ).toMatchObject({ assigneeId });
  }
  await users.update(person.id, { name: 'Assignee after rename' });
  const response = await admin.fetch('/tutorialTasks');
  expect(await response.json()).toMatchObject({
    data: expect.arrayContaining([
      expect.objectContaining({
        assigneeId: person.id,
        assigneeName: 'Assignee after rename',
      }),
    ]),
  });
});

test('rejects unknown, disabled and service accounts without creating a task', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const users = testApp.application.container.resolve(
    userAdministrationServiceToken,
  );
  const person = await users.create({
    name: 'Unavailable',
    email: 'unavailable@example.test',
    password: 'assignment-test-password',
  });
  await users.disable(person.id);
  const service = await users.createServiceAccount({ name: 'Not a person' });
  const repo = testApp.application.container
    .resolve(databaseManagerToken)
    .repository('tutorialTasks');
  const before = await repo.count();
  for (const assigneeId of [randomUUID(), person.id, service.id]) {
    const response = await admin.fetch('/tutorialTasks', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Must not be created', assigneeId }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        reason: 'TASK_ASSIGNEE_INVALID',
        fieldViolations: [{ field: 'assigneeId' }],
      },
    });
  }
  expect(await repo.count()).toBe(before);
});

test('uses task grants without granting user administration, and assignment grants no access', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const users = testApp.application.container.resolve(
    userAdministrationServiceToken,
  );
  const credentials = {
    email: 'task-editor@example.test',
    password: 'assignment-test-password',
  };
  const person = await users.create({ name: 'Task editor', ...credentials });
  const editor = await signIn(testApp, credentials);
  const created = await admin.fetch('/tutorialTasks', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Assigned without permission',
      assigneeId: person.id,
    }),
  });
  expect(created.status).toBe(201);
  expect((await editor.fetch('/tutorialTasks')).status).toBe(403);
  expect((await editor.fetch('/tutorialTasks/assignees')).status).toBe(403);
  const authz = testApp.application.container.resolve(authorizationToken);
  await authz.permissionSets.create({
    key: 'assignment-editor',
    grants: [
      taskPermissions.reference().grant({
        read: { tasks: 'allRecords' },
        create: { tasks: 'allRecords' },
      }),
    ],
  });
  await authz.permissionSets.assign({
    id: 'assignment-editor-user',
    permissionSet: 'assignment-editor',
    subject: { type: 'user', id: person.id },
  });
  expect((await editor.fetch('/tutorialTasks/assignees')).status).toBe(200);
  expect((await editor.fetch('/users')).status).toBe(403);
  const permitted = await editor.fetch('/tutorialTasks', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'Created by ordinary editor',
      assigneeId: person.id,
    }),
  });
  expect(permitted.status).toBe(201);
  expect(await permitted.json()).toMatchObject({
    data: { assigneeId: person.id, assigneeName: 'Task editor' },
  });
  await authz.permissionSets.delete('assignment-editor');
  expect((await editor.fetch('/tutorialTasks/assignees')).status).toBe(403);
});
