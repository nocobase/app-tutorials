import { databaseManagerToken } from '@nocobase/db';
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import {
  signIn,
  DEFAULT_ADMIN_CREDENTIALS,
} from '@nocobase/app-plugin-authentication/testing';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { findUndeclaredApiRoutes } from '@nocobase/app-server/router';
import { taskPermissions } from '../../server/providers/tutorial-tasks.js';
import { createStandaloneServer } from '../../server/standalone.js';

const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    app: { publicOrigin: 'http://localhost' },
    auth: {
      secret: 'tutorial-test-secret-at-least-32-characters',
      advanced: { disableOriginCheck: false, disableCSRFCheck: false },
    },
    users: { initialAdmin: DEFAULT_ADMIN_CREDENTIALS },
    logging: { enabled: false },
  },
});
const headers = {
  'content-type': 'application/json',
  origin: 'http://localhost',
};

test('requires authentication for every task operation', async ({
  request,
}) => {
  for (const [method, path, body] of [
    ['GET', '/tutorialTasks', undefined],
    ['POST', '/tutorialTasks', { title: 'Private task' }],
    ['PATCH', `/tutorialTasks/${randomUUID()}`, { completed: true }],
  ] as const) {
    expect(
      (
        await request(path, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        })
      ).status,
    ).toBe(401);
  }
});

test('persists creation, completion and reopening through the real API', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const created = await admin.fetch('/tutorialTasks', {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: '  Write the tutorial  ' }),
  });
  expect(created.status).toBe(201);
  const { data: task } = (await created.json()) as {
    data: { id: string; title: string; completed: boolean };
  };
  expect(task).toMatchObject({ title: 'Write the tutorial', completed: false });
  for (const completed of [true, false]) {
    const updated = await admin.fetch(`/tutorialTasks/${task.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ completed }),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({
      data: { id: task.id, completed },
    });
    const list = await admin.fetch('/tutorialTasks');
    expect(await list.json()).toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({ id: task.id, completed }),
      ]),
    });
  }
});

test('validates input and reports missing records', async ({ testApp }) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  for (const body of [
    { title: ' ' },
    { title: 'x'.repeat(121) },
    { title: 'Valid', completed: true },
  ]) {
    expect(
      (
        await admin.fetch('/tutorialTasks', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(400);
  }
  expect(
    (
      await admin.fetch(`/tutorialTasks/${randomUUID()}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ completed: 'true' }),
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await admin.fetch(`/tutorialTasks/${randomUUID()}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ completed: true }),
      })
    ).status,
  ).toBe(404);
});

test('keeps page access separate and enforces read-only business access', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const credentials = {
    email: 'tutorial-reader@example.test',
    password: 'tutorial-reader-password',
  };
  const created = await admin.fetch('/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Tutorial reader', ...credentials }),
  });
  expect(created.status).toBe(201);
  const member = await signIn(testApp, credentials);
  const authz = testApp.application.container.resolve(authorizationToken);
  const pageGrant = {
    resource: { type: 'page', id: 'tasks' },
    actions: [{ action: 'access' }],
  };
  await authz.permissionSets.create({
    key: 'tutorial-reader',
    grants: [pageGrant],
  });
  await authz.permissionSets.assign({
    id: 'tutorial-reader-assignment',
    permissionSet: 'tutorial-reader',
    subject: { type: 'user', id: member.user.id },
  });
  expect((await member.fetch('/tutorialTasks')).status).toBe(403);
  expect(
    (
      await member.fetch('/tutorialTasks', {
        method: 'POST',
        headers,
        body: '{}',
      })
    ).status,
  ).toBe(403);
  await authz.permissionSets.update('tutorial-reader', {
    key: 'tutorial-reader',
    grants: [
      pageGrant,
      taskPermissions.reference().grant({ read: { tasks: 'allRecords' } }),
    ],
  });
  expect((await member.fetch('/tutorialTasks')).status).toBe(200);
  expect(
    (
      await member.fetch('/tutorialTasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: 'Denied' }),
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await member.fetch(`/tutorialTasks/${randomUUID()}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ completed: true }),
      })
    ).status,
  ).toBe(403);
});

test('declares all task endpoints in the API document', async ({ testApp }) => {
  expect(findUndeclaredApiRoutes(testApp.application)).toEqual([]);
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const response = await admin.fetch('/swagger');
  expect(response.status).toBe(200);
  const document = (await response.json()) as {
    paths: Record<string, unknown>;
  };
  const operations = JSON.stringify(document.paths);
  for (const id of [
    'listTutorialTasks',
    'createTutorialTask',
    'updateTutorialTask',
  ])
    expect(operations).toContain(id);
});

test('bounds each page and reports the full count', async ({ testApp }) => {
  const database = testApp.application.container.resolve(databaseManagerToken);
  const tasks = database.repository('tutorialTasks');
  const before = await tasks.count();
  for (let i = 0; i < 101; i++) {
    await tasks.createOne({
      values: {
        id: randomUUID(),
        title: `Older task ${i}`,
        completed: false,
        updatedAt: new Date('2020-01-01T00:00:00Z'),
      },
    });
  }
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const response = await admin.fetch('/tutorialTasks');
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    data: unknown[];
    meta: { total: number };
  };
  expect(body.data).toHaveLength(10);
  expect(body.meta.total).toBe(Number(before) + 101);
});
