import {
  defineAppConfig,
  envInteger,
  type AppConfigFactory,
} from '@nocobase/app-server/config';
export interface ActivityLogConfig {
  readonly pageSize: number;
}
export function defineActivityLogConfig(): AppConfigFactory<ActivityLogConfig> {
  return defineAppConfig({
    defaults: { pageSize: 20 },
    env: {
      ACTIVITY_LOG_PAGE_SIZE: envInteger('pageSize', {
        description: 'Default activity log page size, from 1 to 100.',
      }),
    },
    public: ['pageSize'],
    validate(value, context) {
      if (
        !Number.isInteger(value.pageSize) ||
        value.pageSize < 1 ||
        value.pageSize > 100
      ) {
        context.error('pageSize', 'Must be an integer from 1 to 100.');
      }
    },
  });
}
