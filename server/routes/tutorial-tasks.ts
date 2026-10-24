import { randomUUID } from 'node:crypto';
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import {
  userAdministrationServiceToken,
  authenticationToken,
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
import {
  databaseManagerToken,
  type RepositoryFilter,
  type RepositoryPolicy,
} from '@nocobase/db';

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  updatedAt: z.string(),
  assigneeId: z.string().nullable(),
  assigneeName: z.string().nullable(),
});
const createInput = z.strictObject({
  title: z.string().trim().min(1).max(120),
  assigneeId: z.string().min(1).max(255).nullable().optional(),
});
const updateInput = z.strictObject({ completed: z.boolean() });
const listInput = z.object({
  q: z.string().trim().max(120).default(''),
  status: z.enum(['all', 'pending', 'completed']).default('all'),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});
const params = z.object({ id: z.uuid() });
type TaskEnv = {
  Variables: AuthorizationEnv['Variables'] & { taskPolicy: RepositoryPolicy };
};

const taskRoutes: AppApiRouteContribution<Application> = defineApiRoutes(
  (app) => {
    const router = new Hono();
    const tasks = new Hono<TaskEnv>();
    const auth = app.container.resolve(authenticationToken);
    const authz = app.container.resolve(authorizationToken);
    const database = app.container.resolve(databaseManagerToken);
    const users = app.container.resolve(userAdministrationServiceToken);
    // Identity lookups use the authentication service, not its private tables.
    // A single batch resolves display names for the entire task list.
    async function withAssigneeNames(records: Record<string, unknown>[]) {
      const ids = [
        ...new Set(
          records.flatMap((record) =>
            typeof record.assigneeId === 'string' ? [record.assigneeId] : [],
          ),
        ),
      ];
      const page = ids.length
        ? await users.list({ userIds: ids, pageSize: ids.length })
        : undefined;
      const names = new Map(page?.items.map((user) => [user.id, user.name]));
      return records.map((record) => ({
        ...record,
        assigneeName:
          typeof record.assigneeId === 'string'
            ? (names.get(record.assigneeId) ?? null)
            : null,
      }));
    }
    tasks.use('*', auth.required(), authz.middleware());

    const permit =
      (action: 'read' | 'create' | 'update'): MiddlewareHandler<TaskEnv> =>
      async (c, next) => {
        const decision = await c.get('authz').authorize({
          resource: { type: 'composite', id: 'tutorial.tasks' },
          action,
        });
        const policy = decision.conditions?.database?.tutorialTasks;
        if (decision.effect === 'deny' || !policy) {
          throw new ApiError({
            status: 'PERMISSION_DENIED',
            reason: 'TASK_ACTION_DENIED',
            domain: 'tutorialTasks',
            message: 'This task action is not allowed.',
          });
        }
        c.set('taskPolicy', policy);
        await next();
      };

    tasks.get(
      '/assignees',
      permit('create'),
      describeRoute({
        tags: ['Tutorial tasks'],
        summary: 'List eligible task assignees',
        operationId: 'listTutorialTaskAssignees',
        responses: {
          '200': listResponse(z.object({ id: z.string(), name: z.string() })),
          ...apiErrorResponses,
        },
      }),
      async (c) => {
        const page = await users.list({
          status: 'enabled',
          page: 1,
          pageSize: 100,
          sort: 'name',
          order: 'asc',
        });
        return c.json({
          data: page.items.map(({ id, name }) => ({ id, name })),
          meta: { total: page.total },
        });
      },
    );

    tasks.get(
      '/',
      permit('read'),
      describeRoute({
        tags: ['Tutorial tasks'],
        summary: 'List tasks',
        operationId: 'listTutorialTasks',
        responses: { '200': listResponse(taskSchema), ...apiErrorResponses },
      }),
      apiValidator('query', listInput),
      async (c) => {
        const repository = database
          .repository('tutorialTasks')
          .withPolicy(c.get('taskPolicy'));
        const { q, status, page, pageSize } = c.req.valid('query');
        const filter: RepositoryFilter<Record<string, unknown>> = (f) =>
          f.and([
            ...(q ? [f.string('title').includes(q)] : []),
            ...(status !== 'all'
              ? [
                  status === 'completed'
                    ? f.boolean('completed').isTrue()
                    : f.boolean('completed').isFalse(),
                ]
              : []),
          ]);
        const data = await repository.findMany({
          filter,
          limit: pageSize,
          offset: (page - 1) * pageSize,
          sort: (s) => [s.field('updatedAt').desc(), s.field('id').desc()],
        });
        const total = await repository.count({ filter });
        return c.json({ data: await withAssigneeNames(data), meta: { total } });
      },
    );

    tasks.post(
      '/',
      permit('create'),
      describeRoute({
        tags: ['Tutorial tasks'],
        summary: 'Create a task',
        operationId: 'createTutorialTask',
        responses: { '201': dataResponse(taskSchema), ...apiErrorResponses },
      }),
      apiValidator('json', createInput),
      async (c) => {
        const { title, assigneeId = null } = c.req.valid('json');
        if (assigneeId !== null) {
          const assignee = await users.get(assigneeId);
          if (!assignee || assignee.disabledAt || assignee.kind !== 'person') {
            throw new ApiError({
              status: 'INVALID_ARGUMENT',
              reason: 'TASK_ASSIGNEE_INVALID',
              domain: 'tutorialTasks',
              message: 'Choose an enabled person as the assignee.',
              fieldViolations: [
                {
                  field: 'assigneeId',
                  reason: 'TASK_ASSIGNEE_INVALID',
                  description: 'The assignee is unavailable.',
                },
              ],
            });
          }
        }
        const data = await database
          .repository('tutorialTasks')
          .withPolicy(c.get('taskPolicy'))
          .createOne({
            values: {
              id: randomUUID(),
              title,
              assigneeId,
              completed: false,
              updatedAt: new Date(),
            },
          });
        return c.json(
          { data: (await withAssigneeNames([data.record]))[0] },
          201,
        );
      },
    );

    tasks.patch(
      '/:id',
      permit('update'),
      describeRoute({
        tags: ['Tutorial tasks'],
        summary: 'Complete or reopen a task',
        operationId: 'updateTutorialTask',
        responses: {
          '200': dataResponse(taskSchema),
          ...apiErrorResponses,
          '404': apiErrorResponse(404),
        },
      }),
      apiValidator('param', params),
      apiValidator('json', updateInput),
      async (c) => {
        const data = await database
          .repository('tutorialTasks')
          .withPolicy(c.get('taskPolicy'))
          .updateOne({
            filter: { id: c.req.valid('param').id },
            values: { ...c.req.valid('json'), updatedAt: new Date() },
          });
        return c.json({ data: (await withAssigneeNames([data.record]))[0] });
      },
    );

    router.route('/tutorialTasks', tasks);
    return router;
  },
);

export default taskRoutes;
