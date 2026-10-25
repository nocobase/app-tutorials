import {
  defineAppRoutes,
  type AppClientRouteContribution,
} from '@nocobase/app-client/plugins';
import { ACTIVITY_PAGE, PLUGIN_NAME } from '../shared/contracts.js';
export const activityLogRouteId: string = `${PLUGIN_NAME}:${ACTIVITY_PAGE}`;
export const routes: AppClientRouteContribution = defineAppRoutes([
  {
    name: ACTIVITY_PAGE,
    path: '/activity-log',
    auth: 'required',
    authz: { resource: { type: 'page', id: ACTIVITY_PAGE }, action: 'access' },
    navigation: { title: 'title' },
    breadcrumb: { title: 'title' },
    componentLoader: () => import('./page.js'),
  },
]);
