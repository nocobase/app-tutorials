import {
  apiClientToken,
  type ApiClient,
  type ClientApplication,
} from '@nocobase/app-client';
import {
  ServiceProvider,
  createServiceToken,
  type ServiceToken,
} from '@nocobase/service-provider';
import type { ActivityPage } from '../shared/contracts.js';
export interface ActivityLogClient {
  list(page: number, pageSize: number): Promise<ActivityPage>;
}
export const activityLogClientToken: ServiceToken<ActivityLogClient> =
  createServiceToken<ActivityLogClient>(
    '@nocobase/app-plugin-tutorial-activity-log/client',
  );
class ApiActivityLogClient implements ActivityLogClient {
  public constructor(private readonly api: ApiClient) {}
  public async list(page: number, pageSize: number): Promise<ActivityPage> {
    return this.api.request<ActivityPage>({
      path: `activityLog/records?page=${page}&pageSize=${pageSize}`,
      method: 'GET',
    });
  }
}
export class ActivityLogClientProvider extends ServiceProvider<ClientApplication> {
  public readonly name: string =
    '@nocobase/app-plugin-tutorial-activity-log/client';
  public override register(): void {
    this.app.container.singleton(
      activityLogClientToken,
      (resolver) => new ApiActivityLogClient(resolver.resolve(apiClientToken)),
    );
  }
}
