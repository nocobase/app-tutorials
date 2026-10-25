import { createNodeVitestConfig } from '@nocobase/dev-config/vitest/node';
export default createNodeVitestConfig({
  test: {
    include: ['tests/server/plugin-activity-log.test.ts'],
    fileParallelism: false,
    passWithNoTests: false,
  },
});
