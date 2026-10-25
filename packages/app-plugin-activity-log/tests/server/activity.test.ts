import { expect } from 'vitest';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { definePermissionSet } from '@nocobase/authorization/permission-sets';
import {
  apiDocsToken,
  findUndeclaredApiRoutes,
  findApiDocumentSchemaProblems,
} from '@nocobase/app-server/router';
import { activityLogToken } from '../../server/index.js';
import { registerReader, test } from '../helpers/app.js';
const input = {
  actorId: 'operator-1',
  action: 'task.created',
  subject: 'task:one',
  summary: 'Created a task',
};
test('denies anonymous and ungranted users before validating input', async ({
  request,
  testApp,
}) => {
  expect((await request('/activityLog/records?page=bad')).status).toBe(401);
  const reader = await registerReader(testApp, 'denied-reader');
  expect((await reader.fetch('/activityLog/records?page=bad')).status).toBe(
    403,
  );
});
test('records, paginates and documents the real contribution', async ({
  testApp,
  app,
}) => {
  const reader = await registerReader(testApp, 'allowed-reader');
  const authz = app.container.resolve(authorizationToken);
  await authz.permissionSets.create(
    definePermissionSet('activity-reader')
      .grant({
        resource: { type: 'activityLog', id: 'all' },
        actions: [{ action: 'read' }],
      })
      .build(),
  );
  await authz.permissionSets.assign({
    permissionSet: 'activity-reader',
    subject: { type: 'user', id: reader.user.id },
  });
  const service = app.container.resolve(activityLogToken);
  for (let index = 0; index < 3; index++)
    await service.record({ ...input, subject: `task:${index}` });
  const response = await reader.fetch('/activityLog/records?page=2&pageSize=2');
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    data: [expect.objectContaining({ action: 'task.created' })],
    meta: { total: 3, page: 2, pageSize: 2 },
  });
  expect((await reader.fetch('/activityLog/records?pageSize=101')).status).toBe(
    400,
  );
  expect(
    (await reader.fetch('/activityLog/records?unknown=value')).status,
  ).toBe(400);
  expect(findUndeclaredApiRoutes(app)).toEqual([]);
  const document = await app.container.resolve(apiDocsToken).getDocument();
  expect(findApiDocumentSchemaProblems(document)).toEqual([]);
  expect(JSON.stringify(document)).toContain('activityLogListRecords');
});
test('joins the caller transaction and rolls back without a record', async ({
  app,
  database,
}) => {
  const service = app.container.resolve(activityLogToken);
  const before = await service.count();
  await expect(
    database.transaction(async (connection) => {
      await service.record(input, connection);
      throw new Error('Cancel operation');
    }),
  ).rejects.toThrow('Cancel operation');
  expect(await service.count()).toBe(before);
  await database.transaction(async (connection) => {
    await service.record(input, connection);
  });
  expect(await service.count()).toBe(before + 1);
  await expect(service.record({ ...input, summary: '' })).rejects.toThrow();
  expect(await service.count()).toBe(before + 1);
});
