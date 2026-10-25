import { ServiceProvider } from '@nocobase/service-provider';
import { databaseManagerToken } from '@nocobase/db';
import type { AppPluginApplication } from '@nocobase/app-server/plugins';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { PLUGIN_NAME } from '../shared/contracts.js';
import { activityLogToken } from './contracts.js';
import { DatabaseActivityLog } from './service.js';
import type { ActivityLogConfig } from './config.js';
export class ActivityLogProvider extends ServiceProvider<AppPluginApplication> {
  public readonly name: string = PLUGIN_NAME;
  public override register(): void {
    this.app.container.singleton(activityLogToken, (resolver) => {
      const config = this.app.config.get<ActivityLogConfig>('activityLog');
      if (!config)
        throw new Error(
          'Register defineActivityLogConfig() under activityLog.',
        );
      return new DatabaseActivityLog(
        resolver.resolve(databaseManagerToken),
        config.pageSize,
      );
    });
  }
  public override async boot(): Promise<void> {
    const authz = this.app.container.resolve(authorizationToken);
    authz.resourceTypes.add({ type: 'activityLog', actions: ['read'] });
    authz.ui.defaultSection('activityLog', 'business');
  }
}
