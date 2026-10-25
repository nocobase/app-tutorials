import {
  answerApi,
  renderWithApp,
  type ApiCall,
} from '@nocobase/app-testing/client';
import { act, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import activityLog from '../../client/index.js';
import { ActivityLog } from '../../client/activity-log.js';
import enUS from '../../client/locales/en-US.js';
import zhCN from '../../client/locales/zh-CN.js';

it.each([
  ['en-US', enUS],
  ['zh-CN', zhCN],
] as const)(
  'loads the registered plugin locales and entries in %s',
  async (locale, messages) => {
    const pending = Promise.withResolvers<Response>();
    const api = vi.fn((call: ApiCall) =>
      call.method === 'GET' && call.path.split('?')[0] === 'activityLog/records'
        ? pending.promise
        : new Response(null, { status: 404 }),
    );
    try {
      await renderWithApp(<ActivityLog />, {
        plugins: [activityLog()],
        locale,
        fetch: answerApi(api),
      });
      expect(
        screen.getByRole('region', { name: messages.title }),
      ).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(messages.loading);
      await act(async () => {
        pending.resolve(
          Response.json({
            data: [
              {
                id: 'client-entry',
                actorId: 'operator',
                action: 'task.created',
                subject: 'task:one',
                summary: 'Read the migration guide',
                occurredAt: '2026-10-25T12:00:00.000Z',
              },
            ],
            meta: { total: 1, page: 1, pageSize: 20 },
          }),
        );
        await pending.promise;
      });
      expect(await screen.findByRole('listitem')).toHaveTextContent(
        'Read the migration guide',
      );
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(api).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: expect.stringContaining('activityLog/records'),
        }),
      );
    } finally {
      await act(async () => {
        pending.resolve(new Response(null, { status: 503 }));
        await pending.promise;
      });
    }
  },
);

it('reports a denied response using the plugin translation', async () => {
  await renderWithApp(<ActivityLog />, {
    plugins: [activityLog()],
    locale: 'zh-CN',
    fetch: answerApi((call) =>
      call.method === 'GET' && call.path.split('?')[0] === 'activityLog/records'
        ? Response.json(
            { error: { reason: 'AUTHORIZATION_DENIED', message: 'Denied' } },
            { status: 403 },
          )
        : new Response(null, { status: 404 }),
    ),
  });
  expect(await screen.findByRole('alert')).toHaveTextContent(zhCN.failed);
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

it('renders an empty list explicitly', async () => {
  await renderWithApp(<ActivityLog />, {
    plugins: [activityLog()],
    fetch: answerApi((call) =>
      call.method === 'GET' && call.path.split('?')[0] === 'activityLog/records'
        ? { data: [], meta: { total: 0 } }
        : new Response(null, { status: 404 }),
    ),
  });
  expect(await screen.findByText(enUS.empty)).toBeInTheDocument();
});
