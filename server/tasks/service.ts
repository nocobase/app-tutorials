import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import type {
  DatabaseManager,
  RepositoryPolicy,
  RepositoryFilter,
} from '@nocobase/db';
import type { AuthorizationContext } from '@nocobase/app-plugin-authorization/server';
import type { UserAdministrationService } from '@nocobase/app-plugin-authentication/server';
import { ApiError } from '@nocobase/app-server/router';
import { type TaskAction } from './permissions.js';
import { taskRowSchema } from './schemas.js';
import type {
  Task,
  TaskRow,
  createTaskInput,
  editTaskInput,
  listTasksInput,
  progressInput,
} from './schemas.js';

export class TaskService {
  constructor(
    private readonly database: DatabaseManager,
    private readonly users: UserAdministrationService,
  ) {}
  async policy(
    context: AuthorizationContext,
    action: TaskAction,
  ): Promise<RepositoryPolicy> {
    const decision = await context.authorize({
      resource: { type: 'composite', id: 'tasks' },
      action,
    });
    const policy = decision.conditions?.database?.tasks;
    if (decision.effect === 'deny' || !policy)
      throw new ApiError({
        status: 'PERMISSION_DENIED',
        reason: 'TASK_ACTION_DENIED',
        domain: 'tasks',
        message: 'This task action is not allowed.',
      });
    return policy;
  }
  private repository(policy: RepositoryPolicy) {
    return this.database.repository<TaskRow>('tasks').withPolicy(policy);
  }
  async get(policy: RepositoryPolicy, id: string): Promise<TaskRow> {
    const row = await this.repository(policy).findOne({ filter: { id } });
    if (!row)
      throw new ApiError({
        status: 'NOT_FOUND',
        reason: 'TASK_NOT_FOUND',
        domain: 'tasks',
        message: 'The task does not exist or is outside the permitted scope.',
      });
    return taskRowSchema.parse(row);
  }
  async list(
    policy: RepositoryPolicy,
    query: z.infer<typeof listTasksInput>,
    userId: string,
  ) {
    const { q, status, assignee, page, pageSize, sort, order } = query;
    const filter: RepositoryFilter<TaskRow> = (f) =>
      f.and([
        ...(q ? [f.string('title').includes(q)] : []),
        ...(status !== 'all' ? [f.string('status').eq(status)] : []),
        ...(assignee === 'me' ? [f.string('assigneeId').eq(userId)] : []),
      ]);
    const repository = this.repository(policy);
    const rows = await repository.findMany({
      filter,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort: (s) => [
        order === 'asc' ? s.field(sort).asc() : s.field(sort).desc(),
        s.field('id').desc(),
      ],
    });
    return {
      rows: rows.map((row) => taskRowSchema.parse(row)),
      total: await repository.count({ filter }),
    };
  }
  async present(
    rows: readonly TaskRow[],
    context: AuthorizationContext,
  ): Promise<Task[]> {
    if (!rows.length) return [];
    const userIds = [
      ...new Set(
        rows.flatMap((row) => (row.assigneeId ? [row.assigneeId] : [])),
      ),
    ];
    // Batch public identity lookups. Do not expose user profiles or read plugin-owned tables.
    const people = userIds.length
      ? (await this.users.list({ userIds, pageSize: 100, kind: 'person' }))
          .items
      : [];
    const names = new Map(people.map((person) => [person.id, person.name]));
    const ids = rows.map((row) => row.id);
    const allowed = await Promise.all(
      (['edit', 'progress', 'delete'] as const).map(async (action) => {
        const decision = await context.authorize({
          resource: { type: 'composite', id: 'tasks' },
          action,
        });
        const policy = decision.conditions?.database?.tasks;
        if (decision.effect === 'deny' || !policy) return new Set<string>();
        const records = await this.repository(policy).findMany({
          filter: (f) => f.or(ids.map((id) => f.string('id').eq(id))),
        });
        return new Set(
          records.flatMap((record) => (record.id ? [record.id] : [])),
        );
      }),
    );
    return rows.map((row) => ({
      ...row,
      assigneeName: row.assigneeId ? (names.get(row.assigneeId) ?? null) : null,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      permissions: {
        edit: allowed[0].has(row.id),
        progress: allowed[1].has(row.id),
        delete: allowed[2].has(row.id),
      },
    }));
  }
  async assignees(q: string, page: number) {
    const result = await this.users.list({
      search: q,
      status: 'enabled',
      kind: 'person',
      page,
      pageSize: 20,
      sort: 'name',
      order: 'asc',
    });
    return {
      data: result.items.map(({ id, name }) => ({ id, name })),
      meta: { total: result.total, page, pageSize: 20 },
    };
  }
  private async validateAssignee(id: string | null) {
    if (!id) return;
    const result = await this.users.list({
      userIds: [id],
      status: 'enabled',
      kind: 'person',
      pageSize: 1,
    });
    if (!result.items.some((user) => user.id === id))
      throw new ApiError({
        status: 'INVALID_ARGUMENT',
        reason: 'TASK_ASSIGNEE_INVALID',
        domain: 'tasks',
        message: 'Choose an active user.',
        fieldViolations: [
          {
            field: 'assigneeId',
            description: 'Choose an active user or leave unassigned.',
          },
        ],
      });
  }
  async create(
    policy: RepositoryPolicy,
    values: z.infer<typeof createTaskInput>,
  ) {
    await this.validateAssignee(values.assigneeId);
    const now = new Date();
    return taskRowSchema.parse(
      (
        await this.repository(policy).createOne({
          values: {
            ...values,
            id: randomUUID(),
            createdAt: now,
            updatedAt: now,
          },
        })
      ).record,
    );
  }
  async update(
    policy: RepositoryPolicy,
    id: string,
    input: z.infer<typeof editTaskInput> | z.infer<typeof progressInput>,
  ) {
    const { expectedUpdatedAt, ...values } = input;
    const current = await this.get(policy, id);
    if ('assigneeId' in values && values.assigneeId !== current.assigneeId)
      await this.validateAssignee(values.assigneeId);
    const repository = this.repository(policy);
    // The revision predicate is part of the actual write, not only a preflight check.
    const result = await repository.updateMany({
      filter: (f) =>
        f.and([
          f.string('id').eq(id),
          f.date('updatedAt').notBefore(expectedUpdatedAt),
          f.date('updatedAt').notAfter(expectedUpdatedAt),
        ]),
      values: {
        ...values,
        updatedAt: new Date(
          Math.max(Date.now(), new Date(current.updatedAt).getTime() + 1),
        ),
      },
    });
    if (result.updatedCount === 0) await this.conflict(policy, id);
    return this.get(policy, id);
  }
  async remove(
    policy: RepositoryPolicy,
    id: string,
    expectedUpdatedAt: string,
  ) {
    await this.get(policy, id);
    const result = await this.repository(policy).deleteMany({
      filter: (f) =>
        f.and([
          f.string('id').eq(id),
          f.date('updatedAt').notBefore(expectedUpdatedAt),
          f.date('updatedAt').notAfter(expectedUpdatedAt),
        ]),
    });
    if (result.deletedCount === 0) await this.conflict(policy, id);
  }
  private async conflict(policy: RepositoryPolicy, id: string): Promise<never> {
    await this.get(policy, id);
    throw new ApiError({
      status: 'ABORTED',
      reason: 'TASK_CHANGED',
      domain: 'tasks',
      message:
        'The task changed. Reload the latest version before trying again.',
    });
  }
}
