import taskRoutes from './tutorial-tasks.js';
import type { Application } from '@nocobase/app-server/application';
import type { AppRouteContribution } from '@nocobase/app-server/router';

const routes: readonly AppRouteContribution<Application>[] = [taskRoutes];

export default routes;
