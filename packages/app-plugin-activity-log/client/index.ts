import { createElement } from 'react';
import {
  defineClientPlugin,
  type AppClientPluginFactory,
} from '@nocobase/app-client/plugins';
import { PLUGIN_NAME } from '../shared/contracts.js';
import { ActivityLogClientProvider } from './service.js';
import { ActivityLogPreferencesProvider } from './preferences.js';
import { routes } from './routes.js';
import locales from './locales/index.js';
export interface ActivityLogOptions {
  readonly pageSize?: number;
}
const activityLog: AppClientPluginFactory<ActivityLogOptions> =
  defineClientPlugin({
    packageName: PLUGIN_NAME,
    serviceProviders: [ActivityLogClientProvider],
    routes,
    locales,
    reactProviders: (options) => [
      {
        name: 'preferences',
        component: ({ children }) =>
          createElement(
            ActivityLogPreferencesProvider,
            {
              pageSize: options?.pageSize ?? 20,
            },
            children,
          ),
      },
    ],
  });
export default activityLog;
