import type { Application } from '@nocobase/app-server/application';
import type { AppRouteContribution } from '@nocobase/app-server/router';

import tasks from './tasks.js';

const routes: readonly AppRouteContribution<Application>[] = [tasks];

export default routes;
