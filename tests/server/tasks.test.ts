import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import {
  signIn,
  DEFAULT_ADMIN_CREDENTIALS,
} from '@nocobase/app-plugin-authentication/testing';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { taskPermissions } from '../../server/tasks/permissions.js';
import { createStandaloneServer } from '../../server/standalone.js';
import type { Task } from '../../server/tasks/schemas.js';

const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    app: { publicOrigin: 'http://localhost' },
    auth: {
      secret: 'quickstart-test-secret-at-least-32-characters',
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
const body = (value: unknown) => JSON.stringify(value);
const data = async (response: Response) => {
  const result = (await response.json()) as { data: Task };
  expect({ ok: response.ok, result }).toMatchObject({ ok: true });
  return result.data;
};

test('protects all task endpoints before validating request data', async ({
  request,
}) => {
  for (const [method, path] of [
    ['GET', '/tasks'],
    ['GET', '/tasks/assignees'],
    ['POST', '/tasks'],
    ['PATCH', `/tasks/${randomUUID()}`],
    ['PATCH', `/tasks/${randomUUID()}/status`],
    ['DELETE', `/tasks/${randomUUID()}`],
    ['GET', `/tasks/${randomUUID()}/edit`],
    ['GET', `/tasks/${randomUUID()}/delete`],
    ['GET', `/tasks/${randomUUID()}/status`],
  ]) {
    expect((await request(path!, { method, headers })).status).toBe(401);
  }
});

test('persists full task CRUD and rejects stale updates and invalid assignments', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const response = await admin.fetch('/tasks', {
    method: 'POST',
    headers,
    body: body({
      title: '  Prepare launch  ',
      description: 'Review release notes',
      dueDate: '2026-11-01',
      assigneeId: admin.user.id,
    }),
  });
  expect(response.status).toBe(201);
  const task = await data(response);
  expect(task).toMatchObject({
    title: 'Prepare launch',
    status: 'todo',
    dueDate: '2026-11-01',
    assigneeId: admin.user.id,
    permissions: { edit: true, progress: true, delete: true },
  });
  let latest = await data(
    await admin.fetch(`/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers,
      body: body({ status: 'inProgress', expectedUpdatedAt: task.updatedAt }),
    }),
  );
  expect(latest.status).toBe('inProgress');
  expect(
    (
      await admin.fetch(`/tasks/${task.id}/status`, {
        method: 'PATCH',
        headers,
        body: body({ status: 'done', expectedUpdatedAt: task.updatedAt }),
      })
    ).status,
  ).toBe(409);
  latest = await data(
    await admin.fetch(`/tasks/${task.id}`, {
      method: 'PATCH',
      headers,
      body: body({
        title: 'Launch checklist',
        description: 'Ready',
        assigneeId: null,
        dueDate: null,
        expectedUpdatedAt: latest.updatedAt,
      }),
    }),
  );
  expect(latest).toMatchObject({
    title: 'Launch checklist',
    status: 'inProgress',
    assigneeId: null,
    dueDate: null,
  });
  expect((await admin.fetch(`/tasks/${task.id}`)).status).toBe(200);
  for (const input of [
    { title: '' },
    { title: 'x'.repeat(121) },
    { title: 'Bad date', dueDate: '2026-02-30' },
    { title: 'Bad assignee', assigneeId: 'missing-user' },
    { title: 'Bad status', status: 'closed' },
    { title: 'Unknown field', privateFlag: true },
  ]) {
    expect(
      (
        await admin.fetch('/tasks', {
          method: 'POST',
          headers,
          body: body(input),
        })
      ).status,
    ).toBe(400);
  }
  expect(
    (
      await admin.fetch(
        `/tasks/${task.id}?expectedUpdatedAt=${encodeURIComponent(task.updatedAt)}`,
        { method: 'DELETE', headers },
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await admin.fetch(
        `/tasks/${task.id}?expectedUpdatedAt=${encodeURIComponent(latest.updatedAt)}`,
        { method: 'DELETE', headers },
      )
    ).status,
  ).toBe(200);
  expect((await admin.fetch(`/tasks/${task.id}`)).status).toBe(404);
});

test('keeps page, operation and assigned-record permissions independent', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const credentials = {
    email: 'member@example.test',
    password: 'test-member-password',
  };
  expect(
    (
      await admin.fetch('/users', {
        method: 'POST',
        headers,
        body: body({ name: 'Member', ...credentials }),
      })
    ).status,
  ).toBe(201);
  const member = await signIn(testApp, credentials);
  const authorization =
    testApp.application.container.resolve(authorizationToken);
  for (const path of ['/tasks', '/tasks/assignees'])
    expect((await member.fetch(path)).status).toBe(403);
  await authorization.permissionSets.create({
    key: 'page-only',
    grants: [
      {
        resource: { type: 'page', id: 'tasks' },
        actions: [{ action: 'access' }],
      },
    ],
  });
  await authorization.permissionSets.assign({
    permissionSet: 'page-only',
    subject: { type: 'user', id: member.user.id },
  });
  expect((await member.fetch('/tasks')).status).toBe(403);
  await authorization.permissionSets.assign({
    permissionSet: 'task-member',
    subject: { type: 'user', id: member.user.id },
  });
  const own = await data(
    await admin.fetch('/tasks', {
      method: 'POST',
      headers,
      body: body({ title: 'Own task', assigneeId: member.user.id }),
    }),
  );
  const other = await data(
    await admin.fetch('/tasks', {
      method: 'POST',
      headers,
      body: body({ title: 'Other task', assigneeId: admin.user.id }),
    }),
  );
  const list = await member.fetch('/tasks');
  expect(await list.json()).toMatchObject({
    data: [
      expect.objectContaining({
        id: own.id,
        permissions: { edit: false, progress: true, delete: false },
      }),
    ],
    meta: { total: 1 },
  });
  expect((await member.fetch(`/tasks/${other.id}`)).status).toBe(404);
  expect(
    (
      await member.fetch(`/tasks/${other.id}/status`, {
        method: 'PATCH',
        headers,
        body: body({ status: 'done', expectedUpdatedAt: other.updatedAt }),
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await member.fetch(`/tasks/${own.id}/status`, {
        method: 'PATCH',
        headers,
        body: body({ status: 'done', expectedUpdatedAt: own.updatedAt }),
      })
    ).status,
  ).toBe(200);
  for (const [method, path, payload] of [
    ['POST', '/tasks', { title: 'Forbidden' }],
    ['PATCH', `/tasks/${own.id}`, { title: 'Forbidden' }],
    ['DELETE', `/tasks/${own.id}`, undefined],
    [
      'PATCH',
      `/tasks/${own.id}/status`,
      { status: 'todo', title: 'Smuggled', expectedUpdatedAt: own.updatedAt },
    ],
  ] as const) {
    expect(
      (
        await member.fetch(path, {
          method,
          headers,
          body: payload ? body(payload) : undefined,
        })
      ).status,
    ).toBe(method === 'PATCH' && path.endsWith('/status') ? 400 : 403);
  }
  const readerCredentials = {
    email: 'reader@example.test',
    password: 'test-reader-password',
  };
  await admin.fetch('/users', {
    method: 'POST',
    headers,
    body: body({
      name: 'Reader',
      ...readerCredentials,
      roleScopes: { app: ['task-reader'] },
    }),
  });
  const reader = await signIn(testApp, readerCredentials);
  expect((await reader.fetch('/tasks')).status).toBe(200);
  expect(
    (
      await reader.fetch(`/tasks/${own.id}/status`, {
        method: 'PATCH',
        headers,
        body: body({ status: 'todo', expectedUpdatedAt: own.updatedAt }),
      })
    ).status,
  ).toBe(403);
  // A business operation alone does not grant page access; the shell checks its separate resource.
  const actionCredentials = {
    email: 'action@example.test',
    password: 'test-action-password',
  };
  await admin.fetch('/users', {
    method: 'POST',
    headers,
    body: body({ name: 'Action only', ...actionCredentials }),
  });
  const actionOnly = await signIn(testApp, actionCredentials);
  await authorization.permissionSets.create({
    key: 'action-only',
    grants: [
      taskPermissions.reference().grant({ read: { tasks: 'allRecords' } }),
    ],
  });
  await authorization.permissionSets.assign({
    permissionSet: 'action-only',
    subject: { type: 'user', id: actionOnly.user.id },
  });
  expect((await actionOnly.fetch('/tasks')).status).toBe(200);
  expect(
    await authorization
      .for({ principal: { type: 'user', id: actionOnly.user.id } })
      .can({ resource: { type: 'page', id: 'tasks' }, action: 'access' }),
  ).toBe(false);
});

test('filters, sorts and paginates before returning exact totals', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  for (let index = 1; index <= 13; index++)
    await admin.fetch('/tasks', {
      method: 'POST',
      headers,
      body: body({
        title: `Paging ${String(index).padStart(2, '0')}`,
        status: index % 2 ? 'todo' : 'done',
        dueDate: `2026-11-${String(index).padStart(2, '0')}`,
      }),
    });
  const response = await admin.fetch(
    '/tasks?q=Paging&status=todo&sort=dueDate&order=asc&page=2&pageSize=3',
  );
  const result = (await response.json()) as {
    data: Task[];
    meta: { total: number };
  };
  expect(result.meta.total).toBe(7);
  expect(result.data.map((task) => task.title)).toEqual([
    'Paging 07',
    'Paging 09',
    'Paging 11',
  ]);
  expect((await admin.fetch('/tasks?pageSize=1000')).status).toBe(400);
});
