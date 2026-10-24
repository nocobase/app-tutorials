import { databaseManagerToken } from '@nocobase/db';
import { selection } from '@nocobase/authorization/core';
import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import {
  signIn,
  DEFAULT_ADMIN_CREDENTIALS,
} from '@nocobase/app-plugin-authentication/testing';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
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

test('filters before paging, escapes search characters and validates query input', async ({
  testApp,
}) => {
  const repository = testApp.application.container
    .resolve(databaseManagerToken)
    .repository('tutorialTasks');
  const ids = Array.from(
    { length: 13 },
    (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  );
  for (const [i, id] of ids.entries())
    await repository.createOne({
      values: {
        id,
        title: i === 12 ? 'Plan 100%_ready' : `Plan ${i}`,
        completed: i >= 11,
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      },
    });
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const list = async (query: string) => {
    const response = await admin.fetch(`/tutorialTasks?${query}`);
    expect(response.status).toBe(200);
    return (await response.json()) as {
      data: { id: string; completed: boolean }[];
      meta: { total: number };
    };
  };
  const first = await list('q=Plan&status=pending&pageSize=10');
  const second = await list('q=Plan&status=pending&page=2&pageSize=10');
  expect(first.meta.total).toBe(11);
  expect(first.data.map((row) => row.id)).toEqual(ids.slice(1, 11).reverse());
  expect(second.data.map((row) => row.id)).toEqual([ids[0]]);
  expect(second.meta.total).toBe(11);
  expect((await list('q=Plan&status=completed')).data).toHaveLength(2);
  expect((await list('q=100%25_ready')).data.map((row) => row.id)).toEqual([
    ids[12],
  ]);
  expect((await list('q=missing')).meta.total).toBe(0);
  expect((await list('q=Plan&page=99')).data).toEqual([]);
  for (const query of [
    'page=0',
    'page=-1',
    'page=1.5',
    'page=abc',
    'page=1000001',
    'pageSize=0',
    'pageSize=101',
    'status=unknown',
    `q=${'x'.repeat(121)}`,
  ])
    expect((await admin.fetch(`/tutorialTasks?${query}`)).status).toBe(400);
});

test('applies the role record scope to both matching rows and total', async ({
  testApp,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const response = await admin.fetch('/tutorialTasks', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: `Scoped task ${i}` }),
    });
    expect(response.status).toBe(201);
    ids.push(((await response.json()) as { data: { id: string } }).data.id);
  }
  const credentials = {
    email: 'scoped-reader@example.test',
    password: 'scoped-reader-test-password',
  };
  expect(
    (
      await admin.fetch('/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Scoped reader', ...credentials }),
      })
    ).status,
  ).toBe(201);
  const member = await signIn(testApp, credentials);
  const authz = testApp.application.container.resolve(authorizationToken);
  await authz.permissionSets.create({
    key: 'scoped-reader',
    grants: [
      taskPermissions
        .reference()
        .grant({ read: { tasks: selection.records([ids[0], ids[1]]) } }),
    ],
  });
  await authz.permissionSets.assign({
    id: 'scoped-reader-assignment',
    permissionSet: 'scoped-reader',
    subject: { type: 'user', id: member.user.id },
  });
  for (const page of [1, 2]) {
    const response = await member.fetch(
      `/tutorialTasks?q=Scoped&status=pending&pageSize=1&page=${page}`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { id: string }[];
      meta: { total: number };
    };
    expect(body.meta.total).toBe(2);
    expect(body.data).toHaveLength(1);
    expect(ids.slice(0, 2)).toContain(body.data[0].id);
  }
  const hidden = await member.fetch('/tutorialTasks?q=Scoped%20task%202');
  expect(await hidden.json()).toMatchObject({ data: [], meta: { total: 0 } });
});
