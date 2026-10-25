import { Hono } from 'hono';
import { z } from 'zod';
import { authenticationToken } from '@nocobase/app-plugin-authentication/server';
import {
  authorizationToken,
  type AuthorizationEnv,
} from '@nocobase/app-plugin-authorization/server';
import type { AppPluginApplication } from '@nocobase/app-server/plugins';
import {
  defineApiRoutes,
  apiValidator,
  describeRoute,
  apiErrorResponses,
  listResponse,
  type AppApiRouteContribution,
} from '@nocobase/app-server/router';
import { activityLogToken } from './contracts.js';
const record = z.object({
  id: z.string(),
  actorId: z.string(),
  action: z.string(),
  subject: z.string(),
  summary: z.string(),
  occurredAt: z.string(),
});
const query = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export const activityLogRoutes: AppApiRouteContribution<AppPluginApplication> =
  defineApiRoutes(({ container }) => {
    const router = new Hono<AuthorizationEnv>();
    const service = container.resolve(activityLogToken);
    router.use(
      '/activityLog/records',
      container.resolve(authenticationToken).required(),
      container.resolve(authorizationToken).middleware(),
    );
    router.get(
      '/activityLog/records',
      async (context, next) => {
        await context.get('authz').require({
          resource: { type: 'activityLog', id: 'all' },
          action: 'read',
        });
        await next();
      },
      describeRoute({
        tags: ['ActivityLog'],
        summary: 'List activity records',
        operationId: 'activityLogListRecords',
        responses: { '200': listResponse(record), ...apiErrorResponses },
      }),
      apiValidator('query', query),
      async (context) => {
        const { page, pageSize } = context.req.valid('query');
        return context.json(await service.list(page, pageSize));
      },
    );
    return new Hono().route('/', router);
  });
