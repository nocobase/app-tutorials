import { randomUUID } from 'node:crypto';
import type { DatabaseConnection, DatabaseManager } from '@nocobase/db';
import { z } from 'zod';
import type {
  ActivityInput,
  ActivityPage,
  ActivityRecord,
} from '../shared/contracts.js';
import type { ActivityLogService } from './contracts.js';
const inputSchema = z.strictObject({
  actorId: z.string().trim().min(1).max(255),
  action: z.string().trim().min(1).max(80),
  subject: z.string().trim().min(1).max(255),
  summary: z.string().trim().min(1).max(255),
});
export class DatabaseActivityLog implements ActivityLogService {
  public constructor(
    private readonly database: DatabaseManager,
    private readonly defaultPageSize: number,
  ) {}
  public async record(
    input: ActivityInput,
    connection: DatabaseConnection = this.database.connection(),
  ): Promise<ActivityRecord> {
    const values: ActivityRecord = {
      ...inputSchema.parse(input),
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
    };
    const result = await connection
      .repository<ActivityRecord>('tutorialActivityRecords')
      .createOne({ values });
    return result.record;
  }
  public async list(
    page: number = 1,
    pageSize: number = this.defaultPageSize,
  ): Promise<ActivityPage> {
    z.number().int().min(1).max(1000000).parse(page);
    z.number().int().min(1).max(100).parse(pageSize);
    const repository = this.database.repository<ActivityRecord>(
      'tutorialActivityRecords',
    );
    const data = await repository.findMany({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort: (sort) => [
        sort.field('occurredAt').desc(),
        sort.field('id').desc(),
      ],
    });
    return { data, meta: { total: await repository.count(), page, pageSize } };
  }
  public async count(): Promise<number> {
    return this.database.repository('tutorialActivityRecords').count();
  }
}
