import {
  createServiceToken,
  type ServiceToken,
} from '@nocobase/service-provider';
import type { DatabaseConnection } from '@nocobase/db';
import type {
  ActivityInput,
  ActivityPage,
  ActivityRecord,
} from '../shared/contracts.js';
export interface ActivityLogService {
  record(
    input: ActivityInput,
    connection?: DatabaseConnection,
  ): Promise<ActivityRecord>;
  list(page?: number, pageSize?: number): Promise<ActivityPage>;
  count(): Promise<number>;
}
export const activityLogToken: ServiceToken<ActivityLogService> =
  createServiceToken<ActivityLogService>(
    '@nocobase/app-plugin-tutorial-activity-log/service',
  );
