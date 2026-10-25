import CountActivity from './count.js';
import { defineCliPlugin, type AppCliPlugin } from '@nocobase/app-cli';
import { PLUGIN_NAME } from '../shared/contracts.js';
const cli: AppCliPlugin = defineCliPlugin({
  packageName: PLUGIN_NAME,
  commands: { count: CountActivity },
});
export default cli;
