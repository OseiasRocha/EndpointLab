import path from 'path';
import { defineConfig } from 'vitest/config';

const config = defineConfig({
  base: "/endpointlab/",
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['dotenv/config'],
    isolate: true,
    env: {
      DOTENV_CONFIG_PATH: 'config/.env.test',
    },
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, './src'),
    },
  },
});

export default config;
