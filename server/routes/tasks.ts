import { Hono } from 'hono';
import { z } from 'zod';
import type { Application } from '@nocobase/app-server/application';
import {
  defineApiRoutes,
  describeRoute,
  apiValidator,
  apiErrorResponses,
  apiErrorResponse,
  dataResponse,
  listResponse,
  type AppApiRouteContribution,
} from '@nocobase/app-server/router';
import { authenticationToken } from '@nocobase/app-plugin-authentication/server';
import {
  authorizationToken,
  type AuthorizationEnv,
} from '@nocobase/app-plugin-authorization/server';
import type { RepositoryPolicy } from '@nocobase/db';
import type { MiddlewareHandler } from 'hono';
import { taskServiceToken } from '../providers/tasks.js';
import { taskError } from '../tasks/service.js';
import type { TaskAction } from '../tasks/permissions.js';
import {
  createTask,
  editTask,
  listAssignees,
  listTasks,
  progressTask,
  taskId,
  taskSchema,
  taskVersion,
} from '../tasks/schemas.js';

type Env = {
  Variables: AuthorizationEnv['Variables'] & { taskPolicy: RepositoryPolicy };
};
const meta = z.object({
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});
const errors = {
  ...apiErrorResponses,
  '404': apiErrorResponse(404),
  '409': apiErrorResponse(409),
  '400': apiErrorResponse(400),
};
export const taskRoutes: AppApiRouteContribution<Application> = defineApiRoutes(
  (app) => {
    const router = new Hono();
    const tasks = new Hono<Env>();
    const auth = app.container.resolve(authenticationToken);
    const authz = app.container.resolve(authorizationToken);
    const service = app.container.resolve(taskServiceToken);
    tasks.use('*', auth.required(), authz.middleware());
    const gate =
      (action: TaskAction): MiddlewareHandler<Env> =>
      async (c, next) => {
        c.set('taskPolicy', await service.policy(c.get('authz'), action));
        await next();
      };
    tasks.get(
      '/',
      gate('read'),
      describeRoute({
        tags: ['Tasks'],
        operationId: 'listTasks',
        summary: 'List accessible tasks',
        responses: {
          '200': listResponse(taskSchema, meta),
          ...apiErrorResponses,
        },
      }),
      apiValidator('query', listTasks),
      async (c) =>
        c.json(
          await service.list(
            c.get('taskPolicy'),
            c.req.valid('query'),
            c.get('authz'),
          ),
        ),
    );
    tasks.get(
      '/assignees',
      async (c, next) => {
        const decisions = await Promise.all(
          ['create', 'edit'].map((action) =>
            c.get('authz').authorize({
              resource: { type: 'composite', id: 'tasks' },
              action,
            }),
          ),
        );
        if (
          !decisions.some(
            (d) => d.effect !== 'deny' && d.conditions?.database?.tasks,
          )
        )
          throw taskError('PERMISSION_DENIED', 'TASK_ACTION_DENIED');
        await next();
      },
      describeRoute({
        tags: ['Tasks'],
        operationId: 'listTaskAssignees',
        summary: 'List available task assignees',
        responses: {
          '200': listResponse(
            z.object({ id: z.string(), name: z.string() }),
            meta,
          ),
          ...apiErrorResponses,
        },
      }),
      apiValidator('query', listAssignees),
      async (c) => c.json(await service.assignees(c.req.valid('query'))),
    );
    for (const action of ['read', 'edit', 'progress', 'delete'] as const) {
      tasks.get(
        action === 'read' ? '/:id' : `/:id/${action}`,
        gate(action),
        describeRoute({
          tags: ['Tasks'],
          operationId: `getTaskFor${action}`,
          summary: `Read task for ${action}`,
          responses: { '200': dataResponse(taskSchema), ...errors },
        }),
        apiValidator('param', taskId),
        async (c) => {
          const row = await service.find(
            c.get('taskPolicy'),
            c.req.valid('param').id,
          );
          return c.json({
            data: (await service.present([row], c.get('authz')))[0],
          });
        },
      );
    }
    tasks.post(
      '/',
      gate('create'),
      describeRoute({
        tags: ['Tasks'],
        operationId: 'createTask',
        summary: 'Create a task',
        responses: { '201': dataResponse(taskSchema), ...errors },
      }),
      apiValidator('json', createTask),
      async (c) => {
        const row = await service.create(
          c.get('taskPolicy'),
          c.req.valid('json'),
        );
        return c.json(
          { data: (await service.present([row], c.get('authz')))[0] },
          201,
        );
      },
    );
    tasks.patch(
      '/:id',
      gate('edit'),
      describeRoute({
        tags: ['Tasks'],
        operationId: 'editTask',
        summary: 'Edit task details',
        responses: { '200': dataResponse(taskSchema), ...errors },
      }),
      apiValidator('param', taskId),
      apiValidator('json', editTask),
      async (c) => {
        const { expectedUpdatedAt, ...values } = c.req.valid('json');
        const row = await service.change(
          c.get('taskPolicy'),
          c.req.valid('param').id,
          expectedUpdatedAt,
          values,
        );
        return c.json({
          data: (await service.present([row], c.get('authz')))[0],
        });
      },
    );
    tasks.patch(
      '/:id/status',
      gate('progress'),
      describeRoute({
        tags: ['Tasks'],
        operationId: 'progressTask',
        summary: 'Change task progress',
        responses: { '200': dataResponse(taskSchema), ...errors },
      }),
      apiValidator('param', taskId),
      apiValidator('json', progressTask),
      async (c) => {
        const { expectedUpdatedAt, status } = c.req.valid('json');
        const row = await service.change(
          c.get('taskPolicy'),
          c.req.valid('param').id,
          expectedUpdatedAt,
          { status },
        );
        return c.json({
          data: (await service.present([row], c.get('authz')))[0],
        });
      },
    );
    tasks.delete(
      '/:id',
      gate('delete'),
      describeRoute({
        tags: ['Tasks'],
        operationId: 'deleteTask',
        summary: 'Delete a task',
        responses: {
          '200': dataResponse(z.object({ id: z.string() })),
          ...errors,
        },
      }),
      apiValidator('param', taskId),
      apiValidator('query', taskVersion),
      async (c) => {
        const { id } = c.req.valid('param');
        await service.change(
          c.get('taskPolicy'),
          id,
          c.req.valid('query').expectedUpdatedAt,
          {},
          true,
        );
        return c.json({ data: { id } });
      },
    );
    router.route('/tasks', tasks);
    return router;
  },
);
