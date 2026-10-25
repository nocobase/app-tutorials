import { createNodeLibraryConfig, react } from '@nocobase/dev-config/eslint';
export default createNodeLibraryConfig({
  tsconfigRootDir: import.meta.dirname,
  ignores: ['dist/**'],
  overrides: react.map((config) => ({
    ...config,
    files: ['client/**/*.{ts,tsx}'],
  })),
});
