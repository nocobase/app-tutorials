import path from 'node:path';
import {
  defineServerPlugin,
  type AppServerPlugin,
} from '@nocobase/app-server/plugins';
import { PLUGIN_NAME } from '../shared/contracts.js';
import { ActivityLogProvider } from './provider.js';
import { activityLogRoutes } from './routes.js';
const activityLog: AppServerPlugin = defineServerPlugin({
  packageName: PLUGIN_NAME,
  baseDir: path.resolve(import.meta.dirname, '..'),
  serviceProviders: [ActivityLogProvider],
  routes: [activityLogRoutes],
  database: { migrations: './database/migrations' },
});
export default activityLog;
export { activityLogToken, type ActivityLogService } from './contracts.js';
export { defineActivityLogConfig, type ActivityLogConfig } from './config.js';
