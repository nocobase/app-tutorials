import { mergeConfig } from 'vitest/config';
import base from './vitest.config.js';
// Keep validation transforms separate from the running development application.
export default mergeConfig(base, {
  cacheDir: 'node_modules/.vite-quickstart-tests',
});
