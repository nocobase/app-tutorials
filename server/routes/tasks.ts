import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import {
  authenticationToken,
  userAdministrationServiceToken,
} from '@nocobase/app-plugin-authentication/server';
import {
  authorizationToken,
  type AuthorizationEnv,
} from '@nocobase/app-plugin-authorization/server';
import type { Application } from '@nocobase/app-server/application';
import {
  ApiError,
  apiErrorResponses,
  apiErrorResponse,
  apiValidator,
  dataResponse,
  listResponse,
  defineApiRoutes,
  describeRoute,
  type AppApiRouteContribution,
} from '@nocobase/app-server/router';
import { databaseManagerToken, type RepositoryPolicy } from '@nocobase/db';
import { TaskService } from '../tasks/service.js';
import type { TaskAction } from '../tasks/permissions.js';
import {
  assigneeQuery,
  createTaskInput,
  deleteInput,
  editTaskInput,
  listTasksInput,
  progressInput,
  taskIdInput,
  taskSchema,
} from '../tasks/schemas.js';

type Env = {
  Variables: AuthorizationEnv['Variables'] & { taskPolicy: RepositoryPolicy };
};
const routes: AppApiRouteContribution<Application> = defineApiRoutes((app) => {
  const router = new Hono();
  const tasks = new Hono<Env>();
  const auth = app.container.resolve(authenticationToken);
  const authz = app.container.resolve(authorizationToken);
  const service = new TaskService(
    app.container.resolve(databaseManagerToken),
    app.container.resolve(userAdministrationServiceToken),
  );
  tasks.use('*', auth.required(), authz.middleware());
  const permit =
    (action: TaskAction): MiddlewareHandler<Env> =>
    async (c, next) => {
      c.set('taskPolicy', await service.policy(c.get('authz'), action));
      await next();
    };
  const docs = (
    operationId: string,
    summary: string,
    response: ReturnType<typeof dataResponse>,
    status = '200',
  ) =>
    describeRoute({
      tags: ['Tasks'],
      operationId,
      summary,
      responses: {
        [status]: response,
        ...apiErrorResponses,
        '404': apiErrorResponse(404),
        '409': apiErrorResponse(409),
      },
    });
  tasks.get(
    '/',
    permit('read'),
    docs(
      'listTasks',
      'List accessible tasks; date sorting uses database null order.',
      listResponse(taskSchema),
    ),
    apiValidator('query', listTasksInput),
    async (c) => {
      const query = c.req.valid('query');
      const context = c.get('authz');
      const result = await service.list(
        c.get('taskPolicy'),
        query,
        context.identity.principal.id,
      );
      return c.json({
        data: await service.present(result.rows, context),
        meta: {
          total: result.total,
          page: query.page,
          pageSize: query.pageSize,
        },
      });
    },
  );
  tasks.get(
    '/assignees',
    async (c, next) => {
      const context = c.get('authz');
      if (
        !(await context.can({
          resource: { type: 'composite', id: 'tasks' },
          action: 'create',
        })) &&
        !(await context.can({
          resource: { type: 'composite', id: 'tasks' },
          action: 'edit',
        }))
      ) {
        throw new ApiError({
          status: 'PERMISSION_DENIED',
          reason: 'TASK_ACTION_DENIED',
          domain: 'tasks',
          message: 'Assigning tasks is not allowed.',
        });
      }
      await next();
    },
    docs(
      'listTaskAssignees',
      'Search active task assignees by name.',
      listResponse(z.object({ id: z.string(), name: z.string() })),
    ),
    apiValidator('query', assigneeQuery),
    async (c) => {
      const { q, page } = c.req.valid('query');
      return c.json(await service.assignees(q, page));
    },
  );
  tasks.post(
    '/',
    permit('create'),
    docs('createTask', 'Create a task.', dataResponse(taskSchema), '201'),
    apiValidator('json', createTaskInput),
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
  for (const [path, action, id] of [
    ['/:id', 'read', 'getTask'],
    ['/:id/edit', 'edit', 'getTaskForEdit'],
    ['/:id/delete', 'delete', 'getTaskForDelete'],
    ['/:id/status', 'progress', 'getTaskForProgress'],
  ] as const) {
    tasks.get(
      path,
      permit(action),
      docs(
        id,
        'Read the latest task under the matching business permission.',
        dataResponse(taskSchema),
      ),
      apiValidator('param', taskIdInput),
      async (c) => {
        const row = await service.get(
          c.get('taskPolicy'),
          c.req.valid('param').id,
        );
        return c.json({
          data: (await service.present([row], c.get('authz')))[0],
        });
      },
    );
  }
  tasks.patch(
    '/:id',
    permit('edit'),
    docs(
      'editTask',
      'Edit task details and assignment.',
      dataResponse(taskSchema),
    ),
    apiValidator('param', taskIdInput),
    apiValidator('json', editTaskInput),
    async (c) => {
      const row = await service.update(
        c.get('taskPolicy'),
        c.req.valid('param').id,
        c.req.valid('json'),
      );
      return c.json({
        data: (await service.present([row], c.get('authz')))[0],
      });
    },
  );
  tasks.patch(
    '/:id/status',
    permit('progress'),
    docs('updateTaskStatus', 'Update task progress.', dataResponse(taskSchema)),
    apiValidator('param', taskIdInput),
    apiValidator('json', progressInput),
    async (c) => {
      const row = await service.update(
        c.get('taskPolicy'),
        c.req.valid('param').id,
        c.req.valid('json'),
      );
      return c.json({
        data: (await service.present([row], c.get('authz')))[0],
      });
    },
  );
  tasks.delete(
    '/:id',
    permit('delete'),
    docs(
      'deleteTask',
      'Delete a task only if its latest revision still matches.',
      dataResponse(z.object({ id: z.string() })),
    ),
    apiValidator('param', taskIdInput),
    apiValidator('query', deleteInput),
    async (c) => {
      const { id } = c.req.valid('param');
      await service.remove(
        c.get('taskPolicy'),
        id,
        c.req.valid('query').expectedUpdatedAt,
      );
      return c.json({ data: { id } });
    },
  );
  router.route('/tasks', tasks);
  return router;
});
export default routes;
