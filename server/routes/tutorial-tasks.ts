import { randomUUID } from 'node:crypto';
import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { authenticationToken } from '@nocobase/app-plugin-authentication/server';
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

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  completed: z.boolean(),
  updatedAt: z.string(),
});
const createInput = z.strictObject({
  title: z.string().trim().min(1).max(120),
});
const updateInput = z.strictObject({ completed: z.boolean() });
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
      '/',
      permit('read'),
      describeRoute({
        tags: ['Tutorial tasks'],
        summary: 'List tasks',
        operationId: 'listTutorialTasks',
        responses: { '200': listResponse(taskSchema), ...apiErrorResponses },
      }),
      async (c) => {
        const repository = database
          .repository('tutorialTasks')
          .withPolicy(c.get('taskPolicy'));
        const data = await repository.findMany({
          limit: 100,
          sort: (s) => [s.field('updatedAt').desc(), s.field('id').desc()],
        });
        const total = await repository.count();
        return c.json({ data, meta: { total } });
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
        const { title } = c.req.valid('json');
        const data = await database
          .repository('tutorialTasks')
          .withPolicy(c.get('taskPolicy'))
          .createOne({
            values: {
              id: randomUUID(),
              title,
              completed: false,
              updatedAt: new Date(),
            },
          });
        return c.json({ data: data.record }, 201);
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
        return c.json({ data: data.record });
      },
    );

    router.route('/tutorialTasks', tasks);
    return router;
  },
);

export default taskRoutes;
