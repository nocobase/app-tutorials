import { createNodeVitestConfig } from '@nocobase/dev-config/vitest/node';

export default createNodeVitestConfig({
  test: {
    include: ['tests/{server,database}/tutorial-tasks*.test.ts'],
    fileParallelism: false,
    passWithNoTests: false,
  },
});
