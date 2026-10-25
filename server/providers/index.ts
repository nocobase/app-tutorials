import type { ApplicationServiceProviderConstructor } from '@nocobase/app-server/application';

import TasksProvider from './tasks.js';

const serviceProviders: readonly ApplicationServiceProviderConstructor[] = [
  TasksProvider,
];

export default serviceProviders;
