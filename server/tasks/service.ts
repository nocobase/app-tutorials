import { randomUUID } from 'node:crypto';
import { ApiError } from '@nocobase/app-server/router';
import type { AuthorizationContext } from '@nocobase/authorization/core';
import type { DatabaseManager, RepositoryPolicy } from '@nocobase/db';
import { buildFilter } from '@nocobase/repository-input';
import type { UserAdministrationService } from '@nocobase/app-plugin-authentication/server';
import {
  rowSchema,
  type Task,
  type TaskInput,
  type TaskQuery,
  type TaskRow,
} from './schemas.js';
import type { TaskAction } from './permissions.js';

export const taskError = (
  status: 'NOT_FOUND' | 'PERMISSION_DENIED' | 'ABORTED' | 'INVALID_ARGUMENT',
  reason: string,
) => new ApiError({ status, reason, domain: 'tasks', message: reason });
export class TaskService {
  constructor(
    private readonly db: DatabaseManager,
    private readonly users: UserAdministrationService,
  ) {}
  async policy(
    authz: AuthorizationContext,
    action: TaskAction,
  ): Promise<RepositoryPolicy> {
    const decision = await authz.authorize({
      resource: { type: 'composite', id: 'tasks' },
      action,
    });
    const policy = decision.conditions?.database?.tasks;
    if (decision.effect === 'deny' || !policy)
      throw taskError('PERMISSION_DENIED', 'TASK_ACTION_DENIED');
    return policy;
  }
  async find(policy: RepositoryPolicy, id: string): Promise<TaskRow> {
    const row = await this.db
      .repository('tasks')
      .withPolicy(policy)
      .findOne({ filter: { id } });
    if (!row) throw taskError('NOT_FOUND', 'TASK_NOT_FOUND');
    return rowSchema.parse(row);
  }
  async present(rows: TaskRow[], authz: AuthorizationContext): Promise<Task[]> {
    if (!rows.length) return [];
    const ids = rows.map((row) => row.id);
    const userIds = [
      ...new Set(
        rows.flatMap((row) => (row.assigneeId ? [row.assigneeId] : [])),
      ),
    ];
    const names = new Map(
      (userIds.length
        ? (await this.users.list({ userIds, pageSize: 100 })).items
        : []
      ).map((u) => [u.id, u.name]),
    );
    // Three scoped reads per result page, rather than a permission query per row.
    const allowed = await Promise.all(
      (['edit', 'progress', 'delete'] as const).map(async (action) => {
        const decision = await authz.authorize({
          resource: { type: 'composite', id: 'tasks' },
          action,
        });
        const policy = decision.conditions?.database?.tasks;
        if (decision.effect === 'deny' || !policy) return new Set<string>();
        const records = await this.db
          .repository('tasks')
          .withPolicy(policy)
          .findMany({
            filter: (f) => f.or(ids.map((id) => f.string('id').eq(id))),
            select: (s) => s.fields('id'),
          });
        return new Set(records.map((row) => row.id as string));
      }),
    );
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      assigneeName: row.assigneeId ? (names.get(row.assigneeId) ?? null) : null,
      permissions: {
        edit: allowed[0].has(row.id),
        progress: allowed[1].has(row.id),
        delete: allowed[2].has(row.id),
      },
    }));
  }
  async list(
    policy: RepositoryPolicy,
    query: TaskQuery,
    authz: AuthorizationContext,
  ) {
    const repository = this.db.repository('tasks').withPolicy(policy);
    const filter = buildFilter((f) =>
      f.and([
        ...(query.q ? [f.string('title').includes(query.q)] : []),
        ...(query.status ? [f.string('status').eq(query.status)] : []),
      ]),
    );
    const total = await repository.count({ filter });
    const page = Math.min(
      query.page,
      Math.max(1, Math.ceil(total / query.pageSize)),
    );
    const [field, direction] = query.orderBy.split(':');
    const rows = await repository.findMany({
      filter,
      limit: query.pageSize,
      offset: (page - 1) * query.pageSize,
      sort: (s) => [
        s.field(field)[direction === 'asc' ? 'asc' : 'desc']().nullsLast(),
        s.field('id').asc(),
      ],
    });
    return {
      data: await this.present(
        rows.map((r) => rowSchema.parse(r)),
        authz,
      ),
      meta: { total, page, pageSize: query.pageSize },
    };
  }
  async assignees(query: { page: number; pageSize: number; q: string }) {
    const result = await this.users.list({
      page: query.page,
      pageSize: query.pageSize,
      search: query.q,
      status: 'enabled',
    });
    return {
      data: result.items.map(({ id, name }) => ({ id, name })),
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
    };
  }
  async validateOwner(id: string | null) {
    if (!id) return;
    const user = await this.users.get(id);
    if (!user || user.disabledAt || user.kind !== 'person')
      throw taskError('INVALID_ARGUMENT', 'TASK_ASSIGNEE_INVALID');
  }
  async create(policy: RepositoryPolicy, input: TaskInput) {
    await this.validateOwner(input.assigneeId);
    const now = new Date();
    const result = await this.db
      .repository('tasks')
      .withPolicy(policy)
      .createOne({
        values: { ...input, id: randomUUID(), createdAt: now, updatedAt: now },
      });
    return rowSchema.parse(result.record);
  }
  async change(
    policy: RepositoryPolicy,
    id: string,
    expectedUpdatedAt: string,
    values: Partial<TaskInput>,
    remove = false,
  ) {
    if ('assigneeId' in values)
      await this.validateOwner(values.assigneeId ?? null);
    return this.db.transaction(async (connection) => {
      const repository = connection.repository('tasks').withPolicy(policy);
      const found = await repository.findOne({ filter: { id } });
      if (!found) throw taskError('NOT_FOUND', 'TASK_NOT_FOUND');
      const row = rowSchema.parse(found);
      if (row.updatedAt.toISOString() !== expectedUpdatedAt)
        throw taskError('ABORTED', 'TASK_VERSION_CONFLICT');
      const filter = buildFilter((f) =>
        f.and([
          f.string('id').eq(id),
          f.date('updatedAt').notBefore(row.updatedAt),
          f.date('updatedAt').notAfter(row.updatedAt),
        ]),
      );
      try {
        if (remove) {
          await repository.deleteOne({ filter });
          return row;
        }
        const result = await repository.updateOne({
          filter,
          values: {
            ...values,
            updatedAt: new Date(
              Math.max(Date.now(), row.updatedAt.valueOf() + 1),
            ),
          },
        });
        return rowSchema.parse(result.record);
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'RECORD_NOT_FOUND'
        )
          throw taskError('ABORTED', 'TASK_VERSION_CONFLICT');
        throw error;
      }
    });
  }
}
