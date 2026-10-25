import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import {
  signIn,
  DEFAULT_ADMIN_CREDENTIALS,
} from '@nocobase/app-plugin-authentication/testing';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { createStandaloneServer } from '../../server/standalone.js';
import type { Task } from '../../server/tasks/schemas.js';
const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    logging: { enabled: false },
    app: { publicOrigin: 'http://localhost' },
    auth: { secret: 'test-auth-secret-at-least-32-characters' },
  },
});
const json = (method: string, data: unknown) => ({
  method,
  headers: { 'content-type': 'application/json', origin: 'http://localhost' },
  body: JSON.stringify(data),
});
test('persists CRUD, rejects invalid inputs and stale writes, and declares HTTP operations', async ({
  testApp,
}) => {
  expect((await testApp.request('/tasks')).status).toBe(401);
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const bad = await admin.fetch('/tasks', json('POST', { title: '  ' }));
  expect(bad.status).toBe(400);
  expect(
    (
      await admin.fetch(
        '/tasks',
        json('POST', { title: 'Invalid date', dueDate: '2026-02-30' }),
      )
    ).status,
  ).toBe(400);
  const created = await admin.fetch(
    '/tasks',
    json('POST', {
      title: '  Plan launch  ',
      assigneeId: admin.user.id,
      dueDate: '2026-11-01',
    }),
  );
  expect(created.status).toBe(201);
  const { data: task } = (await created.json()) as { data: Task };
  expect(task).toMatchObject({
    title: 'Plan launch',
    status: 'todo',
    assigneeName: admin.user.name,
    permissions: { edit: true, progress: true, delete: true },
  });
  const updated = await admin.fetch(
    `/tasks/${task.id}`,
    json('PATCH', {
      title: 'Prepare launch',
      description: 'Publish the release notes.',
      assigneeId: admin.user.id,
      dueDate: '2026-11-02',
      expectedUpdatedAt: task.updatedAt,
    }),
  );
  expect(await updated.clone().json()).toMatchObject({
    data: { title: 'Prepare launch' },
  });
  expect(updated.status).toBe(200);
  const { data: edited } = (await updated.json()) as { data: Task };
  expect(
    (
      await admin.fetch(
        `/tasks/${task.id}/status`,
        json('PATCH', { status: 'done', expectedUpdatedAt: task.updatedAt }),
      )
    ).status,
  ).toBe(409);
  const progressed = await admin.fetch(
    `/tasks/${task.id}/status`,
    json('PATCH', {
      status: 'inProgress',
      expectedUpdatedAt: edited.updatedAt,
    }),
  );
  expect(progressed.status).toBe(200);
  const { data: current } = (await progressed.json()) as { data: Task };
  const list = await admin.fetch(
    '/tasks?q=launch&status=inProgress&page=1&pageSize=10&orderBy=dueDate:asc',
  );
  expect(list.status).toBe(200);
  expect(await list.json()).toMatchObject({
    data: [{ id: task.id, status: 'inProgress' }],
    meta: { total: 1 },
  });
  expect((await admin.fetch(`/tasks/${task.id}`)).status).toBe(200);
  const removed = await admin.fetch(
    `/tasks/${task.id}?${new URLSearchParams({ expectedUpdatedAt: current.updatedAt })}`,
    { method: 'DELETE', headers: { origin: 'http://localhost' } },
  );
  expect(removed.status).toBe(200);
  expect((await admin.fetch(`/tasks/${task.id}`)).status).toBe(404);
  const swagger = await admin.fetch('/swagger');
  expect(swagger.status).toBe(200);
  const spec = await swagger.text();
  expect(spec).toContain('createTask');
  expect(spec).toContain('progressTask');
});
test('enforces explicit roles, per-record scopes and read-only writes through real requests', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const credentials = {
    email: 'task-member@example.test',
    password: 'test-member-password',
  };
  const user = await admin.fetch(
    '/users',
    json('POST', { ...credentials, name: 'Task member' }),
  );
  expect(user.status).toBe(201);
  const member = await signIn(testApp, credentials);
  expect((await member.fetch('/tasks')).status).toBe(403);
  const authz = testApp.application.container.resolve(authorizationToken);
  await authz.permissionSets.assign({
    id: 'member-role',
    permissionSet: 'task-member',
    subject: { type: 'user', id: member.user.id },
  });
  const ownResponse = await admin.fetch(
    '/tasks',
    json('POST', { title: 'Assigned task', assigneeId: member.user.id }),
  );
  expect(ownResponse.status).toBe(201);
  const { data: own } = (await ownResponse.json()) as { data: Task };
  const { data: other } = (await (
    await admin.fetch(
      '/tasks',
      json('POST', { title: 'Other task', assigneeId: admin.user.id }),
    )
  ).json()) as { data: Task };
  const mine = await member.fetch('/tasks');
  expect(mine.status).toBe(200);
  expect(await mine.json()).toMatchObject({
    data: [
      {
        id: own.id,
        permissions: { edit: false, progress: true, delete: false },
      },
    ],
    meta: { total: 1 },
  });
  expect((await member.fetch(`/tasks/${other.id}`)).status).toBe(404);
  expect(
    (
      await member.fetch(
        `/tasks/${other.id}/status`,
        json('PATCH', { status: 'done', expectedUpdatedAt: other.updatedAt }),
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await member.fetch(
        `/tasks/${own.id}/status`,
        json('PATCH', { status: 'done', expectedUpdatedAt: own.updatedAt }),
      )
    ).status,
  ).toBe(200);
  const readerCredentials = {
    email: 'task-reader@example.test',
    password: 'test-reader-password',
  };
  await admin.fetch(
    '/users',
    json('POST', { ...readerCredentials, name: 'Task reader' }),
  );
  const reader = await signIn(testApp, readerCredentials);
  await authz.permissionSets.assign({
    id: 'reader-role',
    permissionSet: 'task-reader',
    subject: { type: 'user', id: reader.user.id },
  });
  expect((await reader.fetch('/tasks')).status).toBe(200);
  for (const [path, method, values] of [
    ['/tasks', 'POST', { title: 'Forbidden' }],
    [
      `/tasks/${own.id}`,
      'PATCH',
      { title: 'Forbidden', expectedUpdatedAt: own.updatedAt },
    ],
    [
      `/tasks/${own.id}/status`,
      'PATCH',
      { status: 'todo', expectedUpdatedAt: own.updatedAt },
    ],
  ] as const)
    expect((await reader.fetch(path, json(method, values))).status).toBe(403);
  expect(
    (
      await reader.fetch(
        `/tasks/${own.id}?${new URLSearchParams({ expectedUpdatedAt: own.updatedAt })}`,
        { method: 'DELETE', headers: { origin: 'http://localhost' } },
      )
    ).status,
  ).toBe(403);
  expect((await reader.fetch('/tasks/assignees')).status).toBe(403);
});
