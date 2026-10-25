import { defineConfig } from 'vitest/config';
import { createNodeVitestConfig } from '@nocobase/dev-config/vitest/node';
import { createReactVitestConfig } from '@nocobase/dev-config/vitest/react';
export default defineConfig({
  test: {
    fileParallelism: false,
    projects: [
      createNodeVitestConfig({
        test: {
          name: 'node',
          include: ['tests/{server,database,cli}/**/*.test.ts'],
        },
      }),
      createReactVitestConfig({
        test: { name: 'client', include: ['tests/client/**/*.test.tsx'] },
      }),
    ],
  },
});
