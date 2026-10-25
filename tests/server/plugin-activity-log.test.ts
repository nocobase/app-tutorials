import { expect } from 'vitest';
import { createAppTest } from '@nocobase/app-testing/server';
import {
  signIn,
  DEFAULT_ADMIN_CREDENTIALS,
} from '@nocobase/app-plugin-authentication/testing';
import { activityLogToken } from '@nocobase/app-plugin-tutorial-activity-log/server';
import { createStandaloneServer } from '../../server/standalone.js';
const test = createAppTest({
  createServer: createStandaloneServer,
  connections: ['main'],
  config: {
    app: { publicOrigin: 'http://localhost' },
    auth: { secret: 'activity-integration-test-secret-at-least-32-characters' },
    users: { initialAdmin: DEFAULT_ADMIN_CREDENTIALS },
    logging: { enabled: false },
  },
});
const headers = {
  'content-type': 'application/json',
  origin: 'http://localhost',
};
test('task creation calls the plugin service with the verified actor', async ({
  testApp,
  app,
}) => {
  const admin = await signIn(testApp, DEFAULT_ADMIN_CREDENTIALS);
  const created = await admin.fetch('/tutorialTasks', {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Verify plugin integration' }),
  });
  expect(created.status).toBe(201);
  const { data: task } = (await created.json()) as { data: { id: string } };
  const log = await admin.fetch('/activityLog/records');
  expect(log.status).toBe(200);
  expect(await log.json()).toMatchObject({
    data: expect.arrayContaining([
      expect.objectContaining({
        actorId: admin.user.id,
        action: 'task.created',
        subject: `task:${task.id}`,
        summary: 'Created task: Verify plugin integration',
      }),
    ]),
  });
  const before = await app.container.resolve(activityLogToken).count();
  expect(
    (
      await admin.fetch('/tutorialTasks', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: '' }),
      })
    ).status,
  ).toBe(400);
  expect(await app.container.resolve(activityLogToken).count()).toBe(before);
});
